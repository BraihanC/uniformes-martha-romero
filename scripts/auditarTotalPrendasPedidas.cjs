/**
 * Script de Auditoría: totalPrendasPedidas vs Pedidos Reales
 *
 * Este script compara el campo totalPrendasPedidas de cada producto
 * con la suma real de items en pedidos activos (no entregados, no anulados).
 *
 * Ejecutar con: node scripts/auditarTotalPrendasPedidas.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function auditarTotalPrendasPedidas() {
  console.log('========================================');
  console.log('AUDITORÍA: totalPrendasPedidas vs Pedidos');
  console.log('========================================\n');

  try {
    // 1. Obtener todos los pedidos
    console.log('Obteniendo pedidos...');
    const pedidosSnapshot = await db.collection('pedidos').get();
    const pedidos = pedidosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Total pedidos encontrados: ${pedidos.length}\n`);

    // 2. Calcular totalPrendasPedidas esperado por producto
    const prendasPorProducto = {};
    let totalItemsAnalizados = 0;
    let totalItemsAnulados = 0;
    let totalItemsEntregados = 0;
    let totalItemsActivos = 0;

    for (const pedido of pedidos) {
      if (!pedido.items || !Array.isArray(pedido.items)) continue;

      for (const item of pedido.items) {
        totalItemsAnalizados++;

        // Saltar items anulados
        if (item.anulado) {
          totalItemsAnulados++;
          continue;
        }

        // Saltar items entregados
        if (item.estadoItem === 'Entregado') {
          totalItemsEntregados++;
          continue;
        }

        totalItemsActivos++;

        const productoId = item.productoId;
        if (!productoId) {
          console.warn(`  ADVERTENCIA: Item sin productoId en pedido ${pedido.numeroPedido || pedido.id}`);
          continue;
        }

        // Para items activos, contar solo la cantidad pendiente
        // totalPrendasPedidas = cantidad original - cantidadEntregada (entregas parciales)
        const cantidadPendiente = (item.cantidad || 0) - (item.cantidadEntregada || 0);

        if (!prendasPorProducto[productoId]) {
          prendasPorProducto[productoId] = {
            esperado: 0,
            items: [],
            nombreProducto: item.nombre || 'Desconocido'
          };
        }

        prendasPorProducto[productoId].esperado += cantidadPendiente;
        prendasPorProducto[productoId].items.push({
          pedidoNum: pedido.numeroPedido || pedido.id,
          cantidad: item.cantidad,
          cantidadEntregada: item.cantidadEntregada || 0,
          cantidadPendiente,
          estado: item.estadoItem,
          talla: item.talla
        });
      }
    }

    console.log('Resumen de items:');
    console.log(`  - Total items analizados: ${totalItemsAnalizados}`);
    console.log(`  - Items anulados (excluidos): ${totalItemsAnulados}`);
    console.log(`  - Items entregados (excluidos): ${totalItemsEntregados}`);
    console.log(`  - Items activos (contados): ${totalItemsActivos}`);
    console.log(`  - Productos únicos con pedidos activos: ${Object.keys(prendasPorProducto).length}\n`);

    // 3. Obtener todos los productos
    console.log('Obteniendo productos...');
    const productsSnapshot = await db.collection('products').get();
    const productos = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Total productos encontrados: ${productos.length}\n`);

    // 4. Comparar y encontrar discrepancias
    const discrepancias = [];
    let productosCorrectos = 0;
    let productosSinPedidos = 0;

    for (const producto of productos) {
      const totalActual = producto.totalPrendasPedidas || 0;
      const datosCalculados = prendasPorProducto[producto.id];
      const totalEsperado = datosCalculados ? datosCalculados.esperado : 0;

      if (totalActual === totalEsperado) {
        if (totalActual > 0) {
          productosCorrectos++;
        } else {
          productosSinPedidos++;
        }
      } else {
        discrepancias.push({
          id: producto.id,
          nombre: producto.nombre || datosCalculados?.nombreProducto || 'Desconocido',
          referencia: producto.referencia || '',
          talla: producto.talla || '',
          totalActual,
          totalEsperado,
          diferencia: totalActual - totalEsperado,
          items: datosCalculados?.items || []
        });
      }
    }

    // 5. También verificar productos en pedidos que no existen
    const productosEnPedidosNoExistentes = [];
    for (const [productoId, datos] of Object.entries(prendasPorProducto)) {
      const productoExiste = productos.some(p => p.id === productoId);
      if (!productoExiste) {
        productosEnPedidosNoExistentes.push({
          id: productoId,
          nombre: datos.nombreProducto,
          totalEnPedidos: datos.esperado,
          items: datos.items
        });
      }
    }

    // 6. Mostrar resultados
    console.log('========================================');
    console.log('RESULTADOS DE LA AUDITORÍA');
    console.log('========================================\n');

    console.log(`Productos con totalPrendasPedidas correcto: ${productosCorrectos}`);
    console.log(`Productos sin pedidos activos (OK): ${productosSinPedidos}`);
    console.log(`Discrepancias encontradas: ${discrepancias.length}`);
    console.log(`Productos en pedidos que no existen: ${productosEnPedidosNoExistentes.length}\n`);

    if (discrepancias.length > 0) {
      console.log('========================================');
      console.log('DISCREPANCIAS DETECTADAS');
      console.log('========================================\n');

      for (const disc of discrepancias) {
        console.log(`PRODUCTO: ${disc.nombre} (${disc.referencia}) - Talla: ${disc.talla}`);
        console.log(`  ID: ${disc.id}`);
        console.log(`  totalPrendasPedidas actual: ${disc.totalActual}`);
        console.log(`  totalPrendasPedidas esperado: ${disc.totalEsperado}`);
        console.log(`  Diferencia: ${disc.diferencia > 0 ? '+' : ''}${disc.diferencia}`);

        if (disc.items.length > 0) {
          console.log('  Detalle de pedidos activos:');
          for (const item of disc.items) {
            console.log(`    - Pedido ${item.pedidoNum}: ${item.cantidadPendiente} pend. (${item.cantidad} total, ${item.cantidadEntregada} entregadas) [${item.estado}] Talla: ${item.talla}`);
          }
        } else {
          console.log('  No hay pedidos activos para este producto (debería ser 0)');
        }
        console.log('');
      }
    }

    if (productosEnPedidosNoExistentes.length > 0) {
      console.log('========================================');
      console.log('PRODUCTOS EN PEDIDOS QUE NO EXISTEN');
      console.log('========================================\n');

      for (const prod of productosEnPedidosNoExistentes) {
        console.log(`PRODUCTO ELIMINADO: ${prod.nombre}`);
        console.log(`  ID: ${prod.id}`);
        console.log(`  Total en pedidos activos: ${prod.totalEnPedidos}`);
        console.log('  Pedidos afectados:');
        for (const item of prod.items) {
          console.log(`    - Pedido ${item.pedidoNum}: ${item.cantidadPendiente} unidades [${item.estado}]`);
        }
        console.log('');
      }
    }

    // 7. Generar script de corrección si hay discrepancias
    if (discrepancias.length > 0) {
      console.log('========================================');
      console.log('CORRECCIONES SUGERIDAS');
      console.log('========================================\n');

      console.log('Para corregir las discrepancias, ejecuta el siguiente código en la consola de Firebase:\n');

      for (const disc of discrepancias) {
        console.log(`// ${disc.nombre} (${disc.referencia})`);
        console.log(`db.collection('products').doc('${disc.id}').update({ totalPrendasPedidas: ${disc.totalEsperado} });`);
      }
      console.log('');
    }

    console.log('========================================');
    console.log('AUDITORÍA COMPLETADA');
    console.log('========================================');

    // Retornar resumen para uso programático
    return {
      totalPedidos: pedidos.length,
      totalItemsAnalizados,
      totalItemsActivos,
      productosCorrectos,
      productosSinPedidos,
      discrepancias,
      productosEnPedidosNoExistentes
    };

  } catch (error) {
    console.error('Error durante la auditoría:', error);
    throw error;
  }
}

// Ejecutar auditoría
auditarTotalPrendasPedidas()
  .then(resultado => {
    console.log('\nResumen JSON:', JSON.stringify({
      discrepanciasCount: resultado.discrepancias.length,
      productosEnPedidosNoExistentesCount: resultado.productosEnPedidosNoExistentes.length
    }, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
