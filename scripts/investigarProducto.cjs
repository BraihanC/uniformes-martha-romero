// Script para investigar un producto con stock negativo
// Uso: node investigarProducto.cjs <referencia> <talla>
// Ejemplo: node investigarProducto.cjs RIBUDIA 12

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function investigarProducto() {
  const referencia = process.argv[2] || 'RIBUDIA';
  const talla = process.argv[3] || '12';

  console.log(`\n=== INVESTIGANDO PRODUCTO ===`);
  console.log(`Referencia: ${referencia}`);
  console.log(`Talla: ${talla}`);

  // 1. Buscar el producto en inventario
  console.log(`\n--- 1. PRODUCTO EN INVENTARIO ---`);
  const productosSnap = await db.collection('products')
    .where('referencia', '==', referencia)
    .get();

  let productoId = null;

  if (productosSnap.empty) {
    // Intentar buscar por nombre parcial
    const todosProductos = await db.collection('products').get();
    todosProductos.docs.forEach(doc => {
      const p = doc.data();
      if ((p.referencia && p.referencia.includes(referencia)) ||
          (p.nombre && p.nombre.includes(referencia))) {
        if (p.talla === talla) {
          console.log(`\nProducto encontrado:`);
          console.log(`  ID: ${doc.id}`);
          console.log(`  Nombre: ${p.nombre}`);
          console.log(`  Referencia: ${p.referencia}`);
          console.log(`  Talla: ${p.talla}`);
          console.log(`  stockTotal: ${p.stockTotal || 0}`);
          console.log(`  stockReservadoPedidos: ${p.stockReservadoPedidos || 0}`);
          console.log(`  stockReservadoApartados: ${p.stockReservadoApartados || 0}`);
          console.log(`  stockReservadoB2B: ${p.stockReservadoB2B || 0}`);
          productoId = doc.id;
        }
      }
    });
  } else {
    productosSnap.docs.forEach(doc => {
      const p = doc.data();
      if (p.talla === talla) {
        console.log(`\nProducto encontrado:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Nombre: ${p.nombre}`);
        console.log(`  Referencia: ${p.referencia}`);
        console.log(`  Talla: ${p.talla}`);
        console.log(`  stockTotal: ${p.stockTotal || 0}`);
        console.log(`  stockReservadoPedidos: ${p.stockReservadoPedidos || 0}`);
        console.log(`  stockReservadoApartados: ${p.stockReservadoApartados || 0}`);
        console.log(`  stockReservadoB2B: ${p.stockReservadoB2B || 0}`);
        productoId = doc.id;
      }
    });
  }

  if (!productoId) {
    console.log(`\n❌ Producto no encontrado`);
    process.exit(1);
  }

  // 2. Buscar en stockEntries (entradas de inventario)
  console.log(`\n--- 2. ENTRADAS DE INVENTARIO (stockEntries) ---`);
  const entradasSnap = await db.collection('stockEntries')
    .where('productId', '==', productoId)
    .get();

  if (entradasSnap.empty) {
    console.log(`No hay entradas registradas para este producto`);
  } else {
    let totalEntradas = 0;
    entradasSnap.docs.forEach(doc => {
      const e = doc.data();
      totalEntradas += e.cantidad || 0;
      const fecha = e.createdAt?.toDate?.() || e.fechaEntrada?.toDate?.() || 'Sin fecha';
      console.log(`  - ${e.tipoEntrada}: +${e.cantidad} (${fecha})`);
    });
    console.log(`  TOTAL ENTRADAS: +${totalEntradas}`);
  }

  // 3. Buscar en transactions (ventas, devoluciones)
  console.log(`\n--- 3. TRANSACCIONES (ventas/devoluciones) ---`);
  const transSnap = await db.collection('transactions')
    .where('productId', '==', productoId)
    .get();

  if (transSnap.empty) {
    console.log(`No hay transacciones para este producto`);
  } else {
    transSnap.docs.forEach(doc => {
      const t = doc.data();
      const fecha = t.createdAt?.toDate?.() || t.fecha?.toDate?.() || 'Sin fecha';
      console.log(`  - ${t.tipo}: cantidad=${t.cantidad || 'N/A'}, monto=${t.monto} (${fecha})`);
    });
  }

  // 4. Buscar en pedidos POS
  console.log(`\n--- 4. PEDIDOS POS ---`);
  const pedidosSnap = await db.collection('pedidos').get();
  let encontradoEnPedidos = false;

  for (const pedidoDoc of pedidosSnap.docs) {
    const pedido = pedidoDoc.data();
    const itemsRelacionados = (pedido.items || []).filter(item =>
      item.id === productoId || item.productId === productoId
    );

    if (itemsRelacionados.length > 0) {
      encontradoEnPedidos = true;
      console.log(`\n  Pedido #${String(pedido.numeroPedido || 0).padStart(4, '0')} - ${pedido.clienteNombre}`);
      console.log(`  Estado: ${pedido.estado}`);
      itemsRelacionados.forEach(item => {
        console.log(`    - Cantidad: ${item.cantidad}, Lista: ${item.cantidadLista || 0}, Entregada: ${item.cantidadEntregada || 0}`);
        console.log(`      Estado Item: ${item.estadoItem}`);
      });
    }
  }

  if (!encontradoEnPedidos) {
    console.log(`No hay pedidos POS con este producto`);
  }

  // 5. Buscar en pedidos B2B
  console.log(`\n--- 5. PEDIDOS B2B ---`);
  const pedidosB2BSnap = await db.collection('pedidos_b2b').get();
  let encontradoEnB2B = false;

  for (const pedidoDoc of pedidosB2BSnap.docs) {
    const pedido = pedidoDoc.data();
    const productosRelacionados = (pedido.productos || []).filter(p =>
      p.productoId === productoId || p.codigo === referencia
    );

    if (productosRelacionados.length > 0) {
      encontradoEnB2B = true;
      console.log(`\n  Pedido B2B #${String(pedido.numeroPedido || 0).padStart(4, '0')} - ${pedido.clienteNombre}`);
      console.log(`  Estado: ${pedido.estado}`);
      productosRelacionados.forEach(p => {
        console.log(`    - ${p.descripcion} Talla ${p.talla}`);
        console.log(`      Cantidad: ${p.cantidad}, Alistada: ${p.cantidadAlistada || 0}, Enviada: ${p.cantidadEnviada || 0}`);
        console.log(`      Estado: ${p.estadoProduccion}`);
      });
    }
  }

  if (!encontradoEnB2B) {
    console.log(`No hay pedidos B2B con este producto`);
  }

  // 6. Buscar en apartados
  console.log(`\n--- 6. APARTADOS ---`);
  const apartadosSnap = await db.collection('apartados').get();
  let encontradoEnApartados = false;

  for (const apartadoDoc of apartadosSnap.docs) {
    const apartado = apartadoDoc.data();
    const productosRelacionados = (apartado.productos || []).filter(p =>
      p.id === productoId || p.productId === productoId
    );

    if (productosRelacionados.length > 0) {
      encontradoEnApartados = true;
      console.log(`\n  Apartado #${String(apartado.numeroApartado || 0).padStart(4, '0')} - ${apartado.clienteNombre}`);
      console.log(`  Estado: ${apartado.estado}`);
      productosRelacionados.forEach(p => {
        console.log(`    - Cantidad: ${p.cantidad}`);
      });
    }
  }

  if (!encontradoEnApartados) {
    console.log(`No hay apartados con este producto`);
  }

  // 7. Buscar ventas directas (sales)
  console.log(`\n--- 7. VENTAS DIRECTAS (sales) ---`);
  const salesSnap = await db.collection('sales').get();
  let totalVendido = 0;
  let ventasEncontradas = [];

  for (const saleDoc of salesSnap.docs) {
    const sale = saleDoc.data();
    const productosRelacionados = (sale.productos || sale.items || []).filter(p =>
      p.id === productoId || p.productId === productoId
    );

    if (productosRelacionados.length > 0) {
      const fecha = sale.createdAt?.toDate?.() || sale.fecha?.toDate?.() || 'Sin fecha';
      productosRelacionados.forEach(p => {
        totalVendido += p.cantidad || 0;
        ventasEncontradas.push({
          fecha,
          cantidad: p.cantidad || 0
        });
      });
    }
  }

  if (ventasEncontradas.length === 0) {
    console.log(`No hay ventas directas de este producto`);
  } else {
    ventasEncontradas.forEach(v => {
      console.log(`  - Venta: -${v.cantidad} (${v.fecha})`);
    });
    console.log(`  TOTAL VENDIDO: -${totalVendido}`);
  }

  console.log(`\n=== FIN DE INVESTIGACIÓN ===\n`);
}

investigarProducto()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
