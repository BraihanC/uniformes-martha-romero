/**
 * Script de migración: Generar facturas para pedidos antiguos ya entregados
 *
 * Este script:
 * 1. Busca pedidos con estadoGeneral === 'Entregado' y facturado !== true
 * 2. Los ordena cronológicamente por fecha de completado
 * 3. Asigna números de factura consecutivos
 * 4. Crea facturas de referencia para usar en Devoluciones
 *
 * IMPORTANTE: Ejecutar una sola vez
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  runTransaction,
  Timestamp
} from 'firebase/firestore';

// Configuración de Firebase (copiar de src/services/firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyBpqOG1Uf3DlPV49cxUCJo0hQM3nYU0_Do",
  authDomain: "uniformes-martha-romero.firebaseapp.com",
  projectId: "uniformes-martha-romero",
  storageBucket: "uniformes-martha-romero.firebasestorage.app",
  messagingSenderId: "764481730858",
  appId: "1:764481730858:web:2dbd02c61f2b9f5bba23a6"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrarFacturasPedidos() {
  console.log('🚀 Iniciando migración de facturas para pedidos antiguos...\n');

  try {
    // 1. Buscar TODOS los pedidos primero para diagnóstico
    console.log('📋 Buscando todos los pedidos para diagnóstico...');
    const todosPedidosQuery = query(collection(db, 'pedidos'));
    const todosPedidosSnap = await getDocs(todosPedidosQuery);

    console.log(`📊 Total de pedidos en la base de datos: ${todosPedidosSnap.size}\n`);

    // Contar estados
    const estadosCount = {};
    let pedidosEntregados = 0;
    let pedidosEntregadosSinFacturar = 0;

    todosPedidosSnap.forEach(doc => {
      const pedido = doc.data();
      const estado = pedido.estadoGeneral || 'Sin Estado';
      estadosCount[estado] = (estadosCount[estado] || 0) + 1;

      if (estado === 'Entregado') {
        pedidosEntregados++;
        if (!pedido.facturado) {
          pedidosEntregadosSinFacturar++;
        }
      }
    });

    console.log('📈 Distribución de estados:');
    Object.keys(estadosCount).sort().forEach(estado => {
      console.log(`   ${estado}: ${estadosCount[estado]}`);
    });
    console.log(`\n✅ Pedidos con estado "Entregado": ${pedidosEntregados}`);
    console.log(`✅ Pedidos "Entregado" sin facturar: ${pedidosEntregadosSinFacturar}\n`);

    // 2. Buscar pedidos entregados sin factura
    console.log('📋 Buscando pedidos entregados sin facturar...');
    const pedidosQuery = query(
      collection(db, 'pedidos'),
      where('estadoGeneral', '==', 'Entregado')
    );

    const pedidosSnap = await getDocs(pedidosQuery);

    // Filtrar los que no tienen factura
    const pedidosSinFactura = [];
    pedidosSnap.forEach(doc => {
      const pedido = doc.data();
      if (!pedido.facturado && pedido.facturado !== true) {
        pedidosSinFactura.push({
          id: doc.id,
          ...pedido
        });
      }
    });

    console.log(`✅ Encontrados ${pedidosSinFactura.length} pedidos sin facturar\n`);

    if (pedidosSinFactura.length === 0) {
      console.log('✨ No hay pedidos pendientes de facturar. ¡Todo al día!');
      return;
    }

    // 2. Determinar fecha de completado para cada pedido y ordenar
    console.log('📅 Determinando fechas de completado...');
    const pedidosConFecha = pedidosSinFactura.map(pedido => {
      // Usar updatedAt como fecha de completado (última modificación = probablemente última entrega)
      let fechaCompletado;

      if (pedido.updatedAt) {
        fechaCompletado = pedido.updatedAt.toDate ? pedido.updatedAt.toDate() : new Date(pedido.updatedAt);
      } else if (pedido.createdAt) {
        fechaCompletado = pedido.createdAt.toDate ? pedido.createdAt.toDate() : new Date(pedido.createdAt);
      } else {
        fechaCompletado = new Date(); // Fallback a hoy
      }

      return {
        ...pedido,
        fechaCompletado
      };
    });

    // Ordenar por fecha de completado (más antiguo primero)
    pedidosConFecha.sort((a, b) => a.fechaCompletado - b.fechaCompletado);

    console.log('✅ Pedidos ordenados cronológicamente\n');

    // 3. Obtener último número de factura
    console.log('🔢 Obteniendo último número de factura...');

    let ultimoNumero = 0;
    const counterRef = doc(db, 'counters', 'facturas');
    const counterDoc = await getDoc(counterRef);

    if (counterDoc.exists()) {
      ultimoNumero = counterDoc.data().lastNumber || 0;
    } else {
      // Si no existe contador, buscar última factura en sales
      const salesQuery = query(collection(db, 'sales'));
      const salesSnap = await getDocs(salesQuery);

      salesSnap.forEach(doc => {
        const factura = doc.data();
        if (factura.numeroFactura && factura.numeroFactura > ultimoNumero) {
          ultimoNumero = factura.numeroFactura;
        }
      });
    }

    console.log(`✅ Último número de factura: ${ultimoNumero}\n`);

    // 4. Generar facturas para cada pedido
    console.log('📝 Generando facturas...\n');

    let facturasCreadas = 0;
    let numeroActual = ultimoNumero;

    for (const pedido of pedidosConFecha) {
      try {
        // Incrementar número
        numeroActual++;

        // Obtener transacciones existentes de este pedido
        const transQuery = query(
          collection(db, 'transactions'),
          where('pedidoId', '==', pedido.id),
          where('tipo', '==', 'abono_pedido')
        );
        const transSnap = await getDocs(transQuery);
        const transaccionesIds = transSnap.docs.map(doc => doc.id);

        // Crear factura
        const facturaData = {
          numeroFactura: numeroActual,
          tipo: 'pedido', // ✅ Identificador para distinguir de POS
          pedidoId: pedido.id,
          numeroPedido: pedido.numeroPedido || 0,

          // Datos del cliente
          clienteId: pedido.clienteId || '',
          clienteNombre: pedido.clienteNombre || '',
          clienteDocumento: pedido.clienteDocumento || '',
          clienteTelefono: pedido.clienteTelefono || '',

          // Datos del pedido
          items: pedido.items || [],
          total: pedido.total || 0,
          totalAbonado: pedido.totalAbonado || 0,
          saldoPendiente: (pedido.total || 0) - (pedido.totalAbonado || 0),

          // Datos adicionales
          colegioId: pedido.colegioId || '',
          colegioNombre: pedido.colegioNombre || '',
          abonos: pedido.abonos || [],

          // Referencias a transacciones existentes
          transaccionesIds: transaccionesIds,
          yaRegistradoEnCaja: true, // ✅ No duplicar en cierre de caja

          // Fechas - Usar fecha de completado
          createdAt: Timestamp.fromDate(pedido.fechaCompletado),
          fechaFacturacion: Timestamp.fromDate(pedido.fechaCompletado),

          // Metadata de migración
          generadoPorMigracion: true,
          fechaMigracion: Timestamp.now()
        };

        // Guardar factura
        await addDoc(collection(db, 'sales'), facturaData);

        // Actualizar pedido
        const pedidoRef = doc(db, 'pedidos', pedido.id);
        await updateDoc(pedidoRef, {
          facturado: true,
          numeroFactura: numeroActual,
          fechaFacturacion: Timestamp.fromDate(pedido.fechaCompletado)
        });

        facturasCreadas++;

        console.log(`  ✅ Factura #${numeroActual} creada para Pedido #${pedido.numeroPedido}`);
        console.log(`     📅 Fecha: ${pedido.fechaCompletado.toLocaleDateString('es-CO')}`);
        console.log(`     👤 Cliente: ${pedido.clienteNombre}`);
        console.log(`     💰 Total: $${(pedido.total || 0).toLocaleString('es-CO')}\n`);

      } catch (error) {
        console.error(`  ❌ Error al crear factura para pedido ${pedido.numeroPedido}:`, error);
      }
    }

    // 5. Actualizar contador de facturas
    console.log('🔢 Actualizando contador de facturas...');
    await setDoc(counterRef, { lastNumber: numeroActual }, { merge: true });
    console.log(`✅ Contador actualizado a: ${numeroActual}\n`);

    // 6. Resumen
    console.log('═══════════════════════════════════════════');
    console.log('✨ MIGRACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════');
    console.log(`📊 Facturas creadas: ${facturasCreadas}`);
    console.log(`🔢 Rango de números: ${ultimoNumero + 1} - ${numeroActual}`);
    console.log(`📅 Fechas: ${pedidosConFecha[0]?.fechaCompletado.toLocaleDateString('es-CO')} - ${pedidosConFecha[pedidosConFecha.length - 1]?.fechaCompletado.toLocaleDateString('es-CO')}`);
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    throw error;
  }
}

// Ejecutar migración
migrarFacturasPedidos()
  .then(() => {
    console.log('🎉 Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script falló:', error);
    process.exit(1);
  });
