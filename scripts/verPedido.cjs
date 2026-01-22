const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verPedido(numeroPedido) {
  console.log('========================================');
  console.log(`DETALLE DEL PEDIDO #${numeroPedido}`);
  console.log('========================================\n');

  const pedidosRef = db.collection('pedidos');
  const snapshot = await pedidosRef.where('numeroPedido', '==', parseInt(numeroPedido)).get();

  if (snapshot.empty) {
    console.log('Pedido no encontrado');
    return;
  }

  const pedidoDoc = snapshot.docs[0];
  const pedido = pedidoDoc.data();

  console.log('ID:', pedidoDoc.id);
  console.log('Número:', pedido.numeroPedido);
  console.log('Cliente:', pedido.clienteNombre);
  console.log('Estado General:', pedido.estadoGeneral);
  console.log('Fecha:', pedido.createdAt?.toDate?.() || 'N/A');
  console.log('\n--- ITEMS DEL PEDIDO ---');

  pedido.items.forEach((item, index) => {
    console.log(`\nItem ${index}:`);
    console.log('  Referencia:', item.referencia);
    console.log('  Nombre:', item.nombre);
    console.log('  Talla:', item.talla);
    console.log('  Cantidad:', item.cantidad);
    console.log('  estadoItem:', item.estadoItem);
    console.log('  cantidadLista:', item.cantidadLista);
    console.log('  cantidadEntregada:', item.cantidadEntregada);
    console.log('  productoId:', item.productoId);
  });

  console.log('\n========================================');
}

const numeroPedido = process.argv[2] || '43';
verPedido(numeroPedido).then(() => process.exit(0));
