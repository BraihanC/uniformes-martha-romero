/**
 * Script para corregir stockReservadoB2B en inventario
 *
 * Recalcula el stockReservadoB2B basándose en lo que REALMENTE está
 * alistado (pero aún no enviado) en los pedidos B2B activos.
 *
 * Fórmula: stockReservadoB2B = SUM(cantidadAlistada - cantidadEnviada) de todos los pedidos B2B activos
 *
 * Ejecutar con: node scripts/corregir-stock-reservado-b2b.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar credenciales del servicio
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function corregirStockReservadoB2B() {
  console.log('🔧 Iniciando corrección de stockReservadoB2B en inventario...\n');

  try {
    // Estados de pedidos que NO deben contar (ya finalizados)
    const estadosFinalizados = ['Completado', 'Cancelado', 'Entregado'];

    // ═══════════════════════════════════════════════════════════════
    // PASO 1: Leer todos los pedidos B2B activos
    // ═══════════════════════════════════════════════════════════════
    console.log('📦 Leyendo pedidos B2B...');
    const pedidosSnap = await db.collection('pedidos_b2b').get();
    const pedidos = [];

    pedidosSnap.forEach(docSnap => {
      const data = docSnap.data();
      // Solo incluir pedidos activos (no finalizados)
      if (!estadosFinalizados.includes(data.estado)) {
        pedidos.push({ id: docSnap.id, ...data });
      }
    });

    console.log(`   Total pedidos B2B activos: ${pedidos.length}\n`);

    // ═══════════════════════════════════════════════════════════════
    // PASO 2: Calcular reservas reales por producto
    // ═══════════════════════════════════════════════════════════════
    console.log('📊 Calculando reservas reales por producto...');

    // Mapa: productoId -> cantidad reservada real
    const reservasPorProducto = new Map();
    // Para productos sin productoId, usar codigo+talla como clave alternativa
    const reservasPorCodigoTalla = new Map();

    for (const pedido of pedidos) {
      if (!pedido.productos || pedido.productos.length === 0) continue;

      for (const producto of pedido.productos) {
        const cantidadAlistada = producto.cantidadAlistada || 0;
        const cantidadEnviada = producto.cantidadEnviada || 0;

        // Lo que está alistado pero NO enviado = reservado real
        const reservadoReal = Math.max(0, cantidadAlistada - cantidadEnviada);

        if (reservadoReal > 0) {
          // Intentar usar productoId primero
          if (producto.productoId) {
            const actual = reservasPorProducto.get(producto.productoId) || 0;
            reservasPorProducto.set(producto.productoId, actual + reservadoReal);
          } else if (producto.codigo && producto.talla) {
            // Fallback: usar codigo + talla
            const clave = `${producto.codigo}|${producto.talla}`;
            const actual = reservasPorCodigoTalla.get(clave) || 0;
            reservasPorCodigoTalla.set(clave, actual + reservadoReal);
          }

          console.log(`   ${producto.descripcion} (${producto.talla}): +${reservadoReal} reservado`);
          console.log(`      Pedido: ${pedido.numeroPedido || pedido.id}, Alistadas: ${cantidadAlistada}, Enviadas: ${cantidadEnviada}`);
        }
      }
    }

    console.log(`\n   Productos con reservas calculadas: ${reservasPorProducto.size + reservasPorCodigoTalla.size}\n`);

    // ═══════════════════════════════════════════════════════════════
    // PASO 3: Leer inventario actual
    // ═══════════════════════════════════════════════════════════════
    console.log('📦 Leyendo inventario actual...');
    const productosSnap = await db.collection('products').get();
    const productos = [];

    productosSnap.forEach(docSnap => {
      productos.push({ id: docSnap.id, ...docSnap.data() });
    });

    console.log(`   Total productos en inventario: ${productos.length}\n`);

    // ═══════════════════════════════════════════════════════════════
    // PASO 4: Comparar y corregir
    // ═══════════════════════════════════════════════════════════════
    console.log('🔍 Comparando valores actuales vs calculados...\n');

    const correcciones = [];

    for (const producto of productos) {
      const stockReservadoActual = producto.stockReservadoB2B || 0;

      // Buscar la reserva calculada
      let reservaCalculada = 0;

      // Primero buscar por ID
      if (reservasPorProducto.has(producto.id)) {
        reservaCalculada = reservasPorProducto.get(producto.id);
      } else {
        // Fallback: buscar por referencia + talla
        const clave = `${producto.referencia}|${producto.talla}`;
        if (reservasPorCodigoTalla.has(clave)) {
          reservaCalculada = reservasPorCodigoTalla.get(clave);
        }
      }

      // Si hay diferencia, agregar a correcciones
      if (stockReservadoActual !== reservaCalculada) {
        correcciones.push({
          id: producto.id,
          nombre: producto.nombre || producto.descripcion,
          talla: producto.talla,
          referencia: producto.referencia,
          stockReservadoActual,
          reservaCalculada,
          diferencia: reservaCalculada - stockReservadoActual
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PASO 5: Mostrar discrepancias encontradas
    // ═══════════════════════════════════════════════════════════════
    if (correcciones.length === 0) {
      console.log('✅ No hay discrepancias. El stockReservadoB2B está correcto en todos los productos.\n');
      return;
    }

    console.log(`⚠️  Encontradas ${correcciones.length} discrepancias:\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const c of correcciones) {
      console.log(`📦 ${c.nombre} - Talla ${c.talla} (${c.referencia || 'sin ref'})`);
      console.log(`   Actual: ${c.stockReservadoActual} → Correcto: ${c.reservaCalculada} (${c.diferencia >= 0 ? '+' : ''}${c.diferencia})`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ═══════════════════════════════════════════════════════════════
    // PASO 6: Aplicar correcciones
    // ═══════════════════════════════════════════════════════════════
    console.log('🔧 Aplicando correcciones...\n');

    // Usar batch para eficiencia (máximo 500 operaciones por batch)
    const batchSize = 450;
    let batchCount = 0;
    let batch = db.batch();

    for (let i = 0; i < correcciones.length; i++) {
      const c = correcciones[i];
      const productoRef = db.collection('products').doc(c.id);

      batch.update(productoRef, {
        stockReservadoB2B: c.reservaCalculada,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batchCount++;

      // Ejecutar batch si alcanzamos el límite
      if (batchCount >= batchSize || i === correcciones.length - 1) {
        await batch.commit();
        console.log(`   ✅ Batch ejecutado: ${batchCount} productos actualizados`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RESUMEN FINAL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN DE CORRECCIÓN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Pedidos B2B analizados: ${pedidos.length}`);
    console.log(`✅ Productos en inventario: ${productos.length}`);
    console.log(`✅ Productos corregidos: ${correcciones.length}`);
    console.log('\n🎉 Corrección completada exitosamente!\n');

  } catch (error) {
    console.error('\n❌ Error durante la corrección:', error);
    throw error;
  }
}

// Ejecutar el script
corregirStockReservadoB2B()
  .then(() => {
    console.log('✅ Script finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
