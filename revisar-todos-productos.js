// ========================================
// SCRIPT DE REVISIÓN COMPLETA
// Revisa TODOS los productos y detecta descuadres
// ========================================

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
} catch (error) {
  console.error('ERROR: No se encontró serviceAccountKey.json');
  console.error('Por favor, descarga la clave de servicio desde Firebase Console');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log('========================================');
console.log('REVISIÓN COMPLETA DE INVENTARIO');
console.log('Detectando descuadres en TODOS los productos');
console.log('========================================\n');

async function revisarInventarioCompleto() {
  try {
    // 1. Leer todos los pedidos
    console.log('📦 Leyendo todos los pedidos...');
    const pedidosSnapshot = await db.collection('pedidos').get();
    console.log(`   Total pedidos: ${pedidosSnapshot.size}\n`);

    // 2. Calcular stock reservado por producto
    const stockReservadoPorProducto = {}; // { productoId: cantidad }
    const detallesPorProducto = {}; // Para mostrar detalles

    for (const pedidoDoc of pedidosSnapshot.docs) {
      const pedido = pedidoDoc.data();
      const items = pedido.items || [];

      for (const item of items) {
        if (!item.productoId || item.anulado) continue;

        const productoId = item.productoId;
        const estadoItem = item.estadoItem;
        const cantidadTotal = item.cantidad || 0;
        const cantidadLista = item.cantidadLista || 0;
        const cantidadEntregada = item.cantidadEntregada || 0;

        // Calcular cuánto reserva según el estado
        let cantidadReservada = 0;

        if (estadoItem === 'Listo para Entrega') {
          cantidadReservada = Math.max(0, cantidadTotal - cantidadEntregada);
        } else if (estadoItem === 'Parcialmente Listo') {
          cantidadReservada = cantidadLista; // Ya excluye entregadas
        } else if (estadoItem === 'En Producción') {
          cantidadReservada = 0;
        } else if (estadoItem === 'Entregado') {
          cantidadReservada = 0;
        }

        // Sumar al total del producto
        if (!stockReservadoPorProducto[productoId]) {
          stockReservadoPorProducto[productoId] = 0;
          detallesPorProducto[productoId] = {
            pedidos: [],
            nombre: item.nombre || 'Sin nombre',
            referencia: item.referencia || 'N/A',
            talla: item.talla || 'N/A'
          };
        }

        stockReservadoPorProducto[productoId] += cantidadReservada;

        if (cantidadReservada > 0) {
          detallesPorProducto[productoId].pedidos.push({
            numero: pedido.numeroPedido,
            estado: estadoItem,
            cantidad: cantidadReservada
          });
        }
      }
    }

    // 3. Leer todos los productos del inventario
    console.log('📊 Leyendo inventario...');
    const productosSnapshot = await db.collection('products').get();
    console.log(`   Total productos: ${productosSnapshot.size}\n`);

    // 4. Comparar y detectar descuadres
    console.log('🔍 DETECTANDO DESCUADRES...\n');
    console.log('='.repeat(80));

    let productosConDescuadre = [];
    let productosOK = 0;
    let totalDescuadres = 0;

    for (const productoDoc of productosSnapshot.docs) {
      const productoId = productoDoc.id;
      const producto = productoDoc.data();

      const stockReservadoActual = producto.stockReservadoPedidos || 0;
      const stockReservadoCalculado = stockReservadoPorProducto[productoId] || 0;
      const stockTotal = producto.stockTotal || 0;

      // Detectar descuadre
      if (stockReservadoActual !== stockReservadoCalculado) {
        const diferencia = stockReservadoCalculado - stockReservadoActual;
        totalDescuadres++;

        productosConDescuadre.push({
          nombre: producto.nombre || 'Sin nombre',
          referencia: producto.referencia || 'N/A',
          talla: producto.talla || 'N/A',
          stockTotal: stockTotal,
          reservadoActual: stockReservadoActual,
          reservadoCalculado: stockReservadoCalculado,
          diferencia: diferencia,
          detalles: detallesPorProducto[productoId] || null
        });
      } else {
        productosOK++;
      }
    }

    // 5. Mostrar reporte
    if (productosConDescuadre.length === 0) {
      console.log('\n✅ ¡EXCELENTE! No se encontraron descuadres');
      console.log(`   Todos los ${productosOK} productos están correctos\n`);
    } else {
      console.log(`\n⚠️  DESCUADRES ENCONTRADOS: ${productosConDescuadre.length} productos\n`);
      console.log('='.repeat(80));

      // Ordenar por magnitud del descuadre (mayor a menor)
      productosConDescuadre.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

      for (const producto of productosConDescuadre) {
        console.log(`\n📦 ${producto.nombre}`);
        console.log(`   Ref: ${producto.referencia} | Talla: ${producto.talla}`);
        console.log(`   Stock Total: ${producto.stockTotal}`);
        console.log(`   Stock Reservado (BD): ${producto.reservadoActual}`);
        console.log(`   Stock Reservado (Calculado): ${producto.reservadoCalculado}`);

        const simbolo = producto.diferencia > 0 ? '+' : '';
        const color = producto.diferencia > 0 ? '🔴' : '🟡';
        console.log(`   ${color} DIFERENCIA: ${simbolo}${producto.diferencia}`);

        if (producto.diferencia > 0) {
          console.log(`   → FALTA reservar ${producto.diferencia} unidad(es)`);
        } else {
          console.log(`   → SOBRA reserva de ${Math.abs(producto.diferencia)} unidad(es)`);
        }

        // Mostrar pedidos asociados
        if (producto.detalles && producto.detalles.pedidos.length > 0) {
          console.log(`\n   Pedidos con este producto (${producto.reservadoCalculado} reservadas):`);
          producto.detalles.pedidos.forEach(p => {
            console.log(`   • Pedido #${p.numero}: ${p.cantidad} uds (${p.estado})`);
          });
        }

        console.log('-'.repeat(80));
      }

      // Resumen final
      console.log('\n' + '='.repeat(80));
      console.log('RESUMEN');
      console.log('='.repeat(80));
      console.log(`✅ Productos correctos: ${productosOK}`);
      console.log(`⚠️  Productos con descuadre: ${productosConDescuadre.length}`);
      console.log('\n📝 RECOMENDACIÓN:');
      console.log('   Ve a Inventario y haz clic en "🔄 Recalcular Inventario"');
      console.log('   Esto corregirá automáticamente todos los descuadres.');
      console.log('='.repeat(80));
    }

    console.log('\n✅ Revisión completada\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }

  process.exit(0);
}

// Ejecutar
revisarInventarioCompleto();
