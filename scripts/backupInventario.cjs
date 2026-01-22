/**
 * Script para hacer BACKUP del inventario actual
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function backupInventario() {
  console.log('========================================');
  console.log('BACKUP DE INVENTARIO');
  console.log('========================================\n');

  const productsSnapshot = await db.collection('products').get();

  const backup = productsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      referencia: data.referencia || '',
      nombre: data.nombre || '',
      talla: data.talla || '',
      stockTotal: data.stockTotal || 0,
      stockReservadoPedidos: data.stockReservadoPedidos || 0,
      stockReservadoApartados: data.stockReservadoApartados || 0,
      totalPrendasPedidas: data.totalPrendasPedidas || 0
    };
  });

  const fecha = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivoPath = path.join(__dirname, `backup_inventario_${fecha}.json`);

  fs.writeFileSync(archivoPath, JSON.stringify(backup, null, 2));

  console.log(`Productos guardados: ${backup.length}`);
  console.log(`Archivo: ${archivoPath}`);
  console.log('\n¡Backup completado!');
}

backupInventario()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
