/**
 * Script para REVERTIR las correcciones de inventario
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

async function revertirCorrecciones() {
  console.log('========================================');
  console.log('REVIRTIENDO CORRECCIONES DE INVENTARIO');
  console.log('========================================\n');

  // Buscar el archivo de log más reciente
  const files = fs.readdirSync(__dirname).filter(f => f.startsWith('log_correcciones_'));

  if (files.length === 0) {
    console.log('ERROR: No se encontró archivo de log de correcciones.');
    return;
  }

  const logFile = files.sort().pop();
  const logPath = path.join(__dirname, logFile);

  console.log(`Usando archivo: ${logFile}\n`);

  const correcciones = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  console.log(`Productos a revertir: ${correcciones.length}\n`);

  // Cargar todos los productos para mapear referencia -> id
  console.log('Cargando productos...');
  const productsSnapshot = await db.collection('products').get();
  const productosMap = {};
  productsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.referencia) {
      productosMap[data.referencia] = doc.id;
    }
  });
  console.log(`Productos cargados: ${Object.keys(productosMap).length}\n`);

  // Aplicar reversión en batches
  const batchSize = 500;
  let revertidos = 0;
  let errores = 0;
  let noEncontrados = 0;

  for (let i = 0; i < correcciones.length; i += batchSize) {
    const batch = db.batch();
    const batchItems = correcciones.slice(i, i + batchSize);
    let itemsEnBatch = 0;

    for (const correccion of batchItems) {
      const productId = productosMap[correccion.referencia];

      if (!productId) {
        console.log(`No encontrado: ${correccion.referencia}`);
        noEncontrados++;
        continue;
      }

      const productRef = db.collection('products').doc(productId);

      batch.update(productRef, {
        stockTotal: correccion.stockAnterior
      });

      itemsEnBatch++;
      revertidos++;
    }

    if (itemsEnBatch > 0) {
      try {
        await batch.commit();
        console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${itemsEnBatch} productos revertidos`);
      } catch (error) {
        console.error(`Error en batch:`, error.message);
        errores += itemsEnBatch;
        revertidos -= itemsEnBatch;
      }
    }
  }

  console.log('\n========================================');
  console.log('RESULTADO');
  console.log('========================================\n');
  console.log(`Productos revertidos: ${revertidos}`);
  console.log(`No encontrados: ${noEncontrados}`);
  console.log(`Errores: ${errores}`);
  console.log('\n¡Inventario restaurado!');
}

revertirCorrecciones()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
