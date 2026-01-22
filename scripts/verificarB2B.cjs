// Script para verificar la coincidencia entre productos B2B e inventario
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verificarProductosB2B() {
  console.log('=== VERIFICANDO PRODUCTOS B2B vs INVENTARIO ===\n');

  // Buscar pedidos B2B con productos pendientes
  const pedidosB2B = await db.collection('pedidos_b2b').get();

  for (const pedidoDoc of pedidosB2B.docs) {
    const pedido = pedidoDoc.data();
    console.log(`\n📦 Pedido B2B #${String(pedido.numeroPedido || 0).padStart(4, '0')} - ${pedido.clienteNombre}`);
    console.log(`   Estado: ${pedido.estado}`);

    if (!pedido.productos || pedido.productos.length === 0) {
      console.log('   Sin productos');
      continue;
    }

    for (const producto of pedido.productos) {
      console.log(`\n   Producto B2B:`);
      console.log(`     - descripcion: ${producto.descripcion}`);
      console.log(`     - codigo: ${producto.codigo || 'NO TIENE'}`);
      console.log(`     - productoId: ${producto.productoId || 'NO TIENE'}`);
      console.log(`     - talla: ${producto.talla}`);
      console.log(`     - cantidad: ${producto.cantidad}`);
      console.log(`     - cantidadAlistada: ${producto.cantidadAlistada || 0}`);

      // Buscar en inventario por el codigo
      const codigoBuscar = producto.codigo || producto.productoId;

      if (!codigoBuscar) {
        console.log(`     ❌ NO tiene codigo ni productoId para buscar`);
        continue;
      }

      // Buscar por referencia
      const productosSnap = await db.collection('products')
        .where('referencia', '==', codigoBuscar)
        .get();

      if (productosSnap.empty) {
        console.log(`     ❌ NO encontrado en inventario con referencia: ${codigoBuscar}`);

        // Intentar buscar productos similares
        const todosProductos = await db.collection('products')
          .where('nombre', '>=', 'PANTALON')
          .where('nombre', '<=', 'PANTALON\uf8ff')
          .limit(5)
          .get();

        if (!todosProductos.empty) {
          console.log(`     Productos similares encontrados:`);
          todosProductos.docs.forEach(doc => {
            const p = doc.data();
            console.log(`       - ${p.referencia}: ${p.nombre} (Talla: ${p.talla})`);
          });
        }
      } else {
        let encontrado = false;
        productosSnap.docs.forEach(doc => {
          const inv = doc.data();
          if (inv.talla === producto.talla) {
            encontrado = true;
            console.log(`     ✅ ENCONTRADO en inventario:`);
            console.log(`       - ID: ${doc.id}`);
            console.log(`       - referencia: ${inv.referencia}`);
            console.log(`       - nombre: ${inv.nombre}`);
            console.log(`       - talla: ${inv.talla}`);
            console.log(`       - stockTotal: ${inv.stockTotal || 0}`);
            console.log(`       - stockReservadoB2B: ${inv.stockReservadoB2B || 0}`);
          }
        });

        if (!encontrado) {
          console.log(`     ❌ Referencia encontrada pero TALLA NO COINCIDE`);
          productosSnap.docs.forEach(doc => {
            const inv = doc.data();
            console.log(`       - Talla en inventario: ${inv.talla}, Talla B2B: ${producto.talla}`);
          });
        }
      }
    }
  }
}

verificarProductosB2B()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
