/**
 * Script para actualizar costos de entradas de satélite que no tienen valor
 *
 * Problema: Algunas entradas de satélite se crearon antes de que se configuraran
 * los costos de los productos, por lo que tienen costoTotal = 0 o undefined.
 *
 * Solución: Este script obtiene el costoSatelite actual del producto y actualiza
 * TODAS las entradas (pendientes y pagadas) con el costo correcto.
 *
 * Uso: node scripts/actualizar-costos-entradas.js
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';

// Configuración de Firebase (misma que en el proyecto)
const firebaseConfig = {
  apiKey: "AIzaSyDvHL9sGhMy1xy4TVRBaJm6IjhGmCpMpEQ",
  authDomain: "uniformes-6bdfa.firebaseapp.com",
  projectId: "uniformes-6bdfa",
  storageBucket: "uniformes-6bdfa.firebasestorage.app",
  messagingSenderId: "360382027498",
  appId: "1:360382027498:web:53c98d5a60edf098d77d73"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function actualizarCostosEntradas() {
  console.log('='.repeat(60));
  console.log('ACTUALIZACIÓN DE COSTOS EN ENTRADAS DE SATÉLITE');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. Obtener TODAS las entradas de stockEntries (sin filtro para diagnosticar)
    console.log('🔍 Consultando todas las entradas de stock...');
    const todasEntradasSnapshot = await getDocs(collection(db, 'stockEntries'));

    console.log(`📦 Total de entradas en stockEntries: ${todasEntradasSnapshot.size}`);

    // Filtrar solo las de tipo satélite
    const entradasSatelite = todasEntradasSnapshot.docs.filter(docSnap => {
      const data = docSnap.data();
      return data.tipoEntrada === 'satelite';
    });

    console.log(`🏭 Entradas de tipo satélite: ${entradasSatelite.length}`);

    // Mostrar tipos de entrada encontrados para diagnóstico
    const tiposEntrada = new Set();
    todasEntradasSnapshot.docs.forEach(docSnap => {
      const tipo = docSnap.data().tipoEntrada;
      if (tipo) tiposEntrada.add(tipo);
    });
    console.log(`📋 Tipos de entrada encontrados: ${Array.from(tiposEntrada).join(', ') || 'ninguno'}`);
    console.log('');

    const entradasSnapshot = { docs: entradasSatelite, size: entradasSatelite.length };

    console.log(`📦 Total de entradas de satélite encontradas: ${entradasSnapshot.size}`);
    console.log('');

    // 2. Filtrar las que no tienen costo o tienen costo 0
    const entradasSinCosto = [];
    const entradasConCosto = [];

    entradasSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const costoTotal = data.costoTotal || 0;
      const costoUnitario = data.costoUnitario || 0;

      if (costoTotal === 0 || costoUnitario === 0) {
        entradasSinCosto.push({
          id: docSnap.id,
          ...data
        });
      } else {
        entradasConCosto.push({
          id: docSnap.id,
          ...data
        });
      }
    });

    console.log(`✅ Entradas CON costo configurado: ${entradasConCosto.length}`);
    console.log(`⚠️  Entradas SIN costo (a actualizar): ${entradasSinCosto.length}`);
    console.log('');

    if (entradasSinCosto.length === 0) {
      console.log('🎉 ¡No hay entradas que necesiten actualización!');
      return;
    }

    // 3. Obtener todos los productos para buscar los costos
    const productosSnapshot = await getDocs(collection(db, 'products'));
    const productosMap = new Map();
    productosSnapshot.docs.forEach(docSnap => {
      productosMap.set(docSnap.id, docSnap.data());
    });

    console.log(`📋 Productos en base de datos: ${productosMap.size}`);
    console.log('');

    // 4. Analizar cada entrada sin costo
    console.log('-'.repeat(60));
    console.log('DETALLE DE ENTRADAS A ACTUALIZAR:');
    console.log('-'.repeat(60));

    const actualizaciones = [];
    const sinProducto = [];
    const sinCostoSatelite = [];

    for (const entrada of entradasSinCosto) {
      const producto = productosMap.get(entrada.productId);

      if (!producto) {
        sinProducto.push(entrada);
        console.log(`❌ Entrada ${entrada.id}: Producto ${entrada.productId} no encontrado`);
        continue;
      }

      const costoSatelite = producto.costoSatelite || 0;

      if (costoSatelite === 0) {
        sinCostoSatelite.push({
          entrada,
          producto
        });
        console.log(`⚠️  Entrada ${entrada.id}: Producto "${producto.nombre}" no tiene costoSatelite configurado`);
        continue;
      }

      const cantidad = entrada.cantidad || 0;
      const nuevoCostoTotal = costoSatelite * cantidad;

      actualizaciones.push({
        entrada,
        producto,
        costoUnitario: costoSatelite,
        costoTotal: nuevoCostoTotal
      });

      console.log(`✅ Entrada ${entrada.id}:`);
      console.log(`   Producto: ${producto.nombre} (${producto.referencia})`);
      console.log(`   Cantidad: ${cantidad}`);
      console.log(`   Costo Unitario: $${costoSatelite.toLocaleString('es-CO')}`);
      console.log(`   Costo Total: $${nuevoCostoTotal.toLocaleString('es-CO')}`);
      console.log('');
    }

    console.log('-'.repeat(60));
    console.log('RESUMEN:');
    console.log('-'.repeat(60));
    console.log(`✅ Entradas listas para actualizar: ${actualizaciones.length}`);
    console.log(`❌ Entradas sin producto (huérfanas): ${sinProducto.length}`);
    console.log(`⚠️  Entradas con producto sin costoSatelite: ${sinCostoSatelite.length}`);
    console.log('');

    if (actualizaciones.length === 0) {
      console.log('⚠️  No hay entradas que se puedan actualizar automáticamente.');

      if (sinCostoSatelite.length > 0) {
        console.log('');
        console.log('📋 Productos que necesitan costoSatelite configurado:');
        const productosUnicos = new Set();
        sinCostoSatelite.forEach(({ producto }) => {
          const key = `${producto.referencia} - ${producto.nombre}`;
          if (!productosUnicos.has(key)) {
            productosUnicos.add(key);
            console.log(`   - ${key}`);
          }
        });
        console.log('');
        console.log('👉 Configura los costos en: Configuración > Gestión de Costos');
      }
      return;
    }

    // 5. Confirmar antes de actualizar
    const totalAPagar = actualizaciones.reduce((sum, a) => sum + a.costoTotal, 0);
    console.log(`💰 Total a pagar después de actualización: $${totalAPagar.toLocaleString('es-CO')}`);
    console.log('');

    // Preguntar confirmación
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const respuesta = await new Promise(resolve => {
      rl.question('¿Deseas aplicar estas actualizaciones? (s/n): ', resolve);
    });
    rl.close();

    if (respuesta.toLowerCase() !== 's') {
      console.log('');
      console.log('❌ Operación cancelada por el usuario.');
      return;
    }

    // 6. Aplicar actualizaciones en batch
    console.log('');
    console.log('🔄 Aplicando actualizaciones...');

    const batch = writeBatch(db);

    for (const { entrada, costoUnitario, costoTotal } of actualizaciones) {
      const entradaRef = doc(db, 'stockEntries', entrada.id);
      batch.update(entradaRef, {
        costoUnitario,
        costoTotal
      });

      // También actualizar la transacción asociada si existe
      const transQuery = query(
        collection(db, 'transactions'),
        where('entradaId', '==', entrada.id),
        where('tipo', '==', 'entrada_satelite')
      );
      const transSnapshot = await getDocs(transQuery);

      if (!transSnapshot.empty) {
        transSnapshot.docs.forEach(transDoc => {
          const transRef = doc(db, 'transactions', transDoc.id);
          batch.update(transRef, {
            monto: -costoTotal,
            costoUnitario
          });
        });
      }
    }

    await batch.commit();

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log(`   Entradas actualizadas: ${actualizaciones.length}`);
    console.log(`   Total a pagar: $${totalAPagar.toLocaleString('es-CO')}`);
    console.log('');
    console.log('👉 Ahora puedes ver los montos correctos en Cuentas por Pagar');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error(error);
  }
}

// Ejecutar
actualizarCostosEntradas().then(() => {
  console.log('');
  console.log('Script finalizado.');
  process.exit(0);
}).catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
