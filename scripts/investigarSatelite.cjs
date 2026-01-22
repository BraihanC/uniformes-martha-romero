const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function investigarSatelite() {
  console.log('=== INVESTIGANDO SATÉLITE "DOÑA GLADYS" ===\n');

  // 1. Buscar el satélite
  console.log('1. Buscando satélite en colección "satelites"...\n');
  const satelitesSnapshot = await db.collection('satelites').get();

  let sateliteEncontrado = null;
  satelitesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.nombre || 'Sin nombre'}`);
    if (data.nombre && data.nombre.toLowerCase().includes('gladys')) {
      sateliteEncontrado = { id: doc.id, ...data };
    }
  });

  if (!sateliteEncontrado) {
    console.log('\n❌ No se encontró satélite con nombre "Gladys"');
    process.exit(0);
  }

  console.log(`\n✅ Satélite encontrado:`);
  console.log(`   ID: ${sateliteEncontrado.id}`);
  console.log(`   Nombre: ${sateliteEncontrado.nombre}`);
  console.log(`   Código: ${sateliteEncontrado.codigo || 'N/A'}`);

  // 2. Buscar entradas de este satélite
  console.log('\n2. Buscando entradas de stock de este satélite...\n');

  const entradasSnapshot = await db.collection('stockEntries')
    .where('tipoEntrada', '==', 'satelite')
    .where('sateliteId', '==', sateliteEncontrado.id)
    .get();

  if (entradasSnapshot.empty) {
    console.log('   No hay entradas de stock para este satélite');
  } else {
    console.log(`   Total de entradas encontradas: ${entradasSnapshot.docs.length}\n`);

    let totalPagado = 0;
    let totalNoPagado = 0;
    let entradasSinCampoPagado = 0;

    entradasSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const fecha = data.createdAt?.toDate?.() || 'Sin fecha';
      const pagado = data.pagado;
      const anulada = data.anulada;
      const costo = data.costoTotal || 0;

      console.log(`   - ID: ${doc.id}`);
      console.log(`     Fecha: ${fecha}`);
      console.log(`     Producto: ${data.productoNombre || 'N/A'}`);
      console.log(`     Cantidad: ${data.cantidad || 0}`);
      console.log(`     Costo Total: $${costo.toLocaleString()}`);
      console.log(`     Campo "pagado": ${pagado === undefined ? 'NO EXISTE' : pagado}`);
      console.log(`     Campo "anulada": ${anulada === undefined ? 'NO EXISTE' : anulada}`);
      console.log('');

      if (pagado === undefined) {
        entradasSinCampoPagado++;
        totalNoPagado += costo;
      } else if (pagado === true) {
        totalPagado += costo;
      } else {
        totalNoPagado += costo;
      }
    });

    console.log('=== RESUMEN ===');
    console.log(`Total entradas: ${entradasSnapshot.docs.length}`);
    console.log(`Entradas SIN campo "pagado": ${entradasSinCampoPagado}`);
    console.log(`Total pagado: $${totalPagado.toLocaleString()}`);
    console.log(`Total NO pagado (incluyendo sin campo): $${totalNoPagado.toLocaleString()}`);

    if (entradasSinCampoPagado > 0) {
      console.log('\n⚠️ PROBLEMA DETECTADO: Hay entradas sin el campo "pagado"');
      console.log('   Firestore no las devuelve cuando se busca "pagado == false"');
    }
  }

  process.exit(0);
}

investigarSatelite().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
