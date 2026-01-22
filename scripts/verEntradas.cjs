const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verEntradas(referencia) {
  console.log('========================================');
  console.log(`ENTRADAS DE: ${referencia}`);
  console.log('========================================\n');

  const entriesRef = db.collection('stockEntries');
  const snapshot = await entriesRef.where('referencia', '==', referencia).get();

  if (snapshot.empty) {
    console.log('No hay entradas para este producto');
    return;
  }

  snapshot.docs.forEach((doc, idx) => {
    const entry = doc.data();
    const fecha = entry.fechaEntrada?.toDate?.() || entry.createdAt?.toDate?.() || 'N/A';

    console.log(`\n--- ENTRADA ${idx + 1} ---`);
    console.log('ID:', doc.id);
    console.log('Fecha:', fecha);
    console.log('Tipo:', entry.tipoEntrada);
    console.log('Cantidad:', entry.cantidad);
    console.log('Cantidad Buena:', entry.cantidadBuena);
    console.log('Cantidad Defectuosa:', entry.cantidadDefectuosa);
    console.log('Cantidad Asignada:', entry.cantidadAsignada);
    console.log('Cantidad Disponible:', entry.cantidadDisponible);

    if (entry.asignaciones && entry.asignaciones.length > 0) {
      console.log('\nASIGNACIONES A PEDIDOS:');
      entry.asignaciones.forEach((asig, i) => {
        console.log(`  ${i + 1}. Pedido #${asig.numeroPedido} - ${asig.clienteNombre}`);
        console.log(`     Cantidad asignada: ${asig.cantidad || asig.cantidadAsignada || 0}`);
        console.log(`     Tipo: ${asig.tipo || 'N/A'}`);
      });
    } else {
      console.log('\nSin asignaciones a pedidos');
    }
  });

  console.log('\n========================================');
}

const referencia = process.argv[2] || 'MA002T8';
verEntradas(referencia).then(() => process.exit(0));
