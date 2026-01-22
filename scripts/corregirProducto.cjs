/**
 * Script para corregir el stock de un producto específico
 *
 * Uso: node scripts/corregirProducto.cjs <REFERENCIA> <STOCK_TOTAL> [RES_PEDIDOS] [RES_APARTADOS]
 * Ejemplo: node scripts/corregirProducto.cjs MA019T8 5 1 0
 */

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function corregirProducto(referencia, nuevoStock, resPedidos, resApartados) {
  console.log('========================================');
  console.log('CORREGIR PRODUCTO');
  console.log('========================================\n');

  // Buscar producto por referencia
  const snapshot = await db.collection('products')
    .where('referencia', '==', referencia)
    .get();

  if (snapshot.empty) {
    console.log(`ERROR: No se encontró producto con referencia: ${referencia}`);
    return;
  }

  const doc = snapshot.docs[0];
  const producto = doc.data();

  console.log(`Producto: ${producto.nombre}`);
  console.log(`Referencia: ${producto.referencia}`);
  console.log(`Talla: ${producto.talla}`);
  console.log('');
  console.log('VALORES ACTUALES:');
  console.log(`  stockTotal: ${producto.stockTotal || 0}`);
  console.log(`  stockReservadoPedidos: ${producto.stockReservadoPedidos || 0}`);
  console.log(`  stockReservadoApartados: ${producto.stockReservadoApartados || 0}`);
  console.log('');
  console.log('VALORES NUEVOS:');
  console.log(`  stockTotal: ${nuevoStock}`);
  if (resPedidos !== undefined) console.log(`  stockReservadoPedidos: ${resPedidos}`);
  if (resApartados !== undefined) console.log(`  stockReservadoApartados: ${resApartados}`);
  console.log('');

  // Construir objeto de actualización
  const updateData = {
    stockTotal: nuevoStock,
    _correccionManual: {
      stockTotalAnterior: producto.stockTotal || 0,
      stockTotalNuevo: nuevoStock,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
      motivo: 'Corrección manual de inventario'
    }
  };

  if (resPedidos !== undefined) {
    updateData.stockReservadoPedidos = resPedidos;
    updateData._correccionManual.resPedidosAnterior = producto.stockReservadoPedidos || 0;
    updateData._correccionManual.resPedidosNuevo = resPedidos;
  }

  if (resApartados !== undefined) {
    updateData.stockReservadoApartados = resApartados;
    updateData._correccionManual.resApartadosAnterior = producto.stockReservadoApartados || 0;
    updateData._correccionManual.resApartadosNuevo = resApartados;
  }

  // Actualizar
  await db.collection('products').doc(doc.id).update(updateData);

  console.log('✅ Producto actualizado correctamente');
}

// Obtener argumentos
const referencia = process.argv[2];
const nuevoStock = parseInt(process.argv[3]);
const resPedidos = process.argv[4] !== undefined ? parseInt(process.argv[4]) : undefined;
const resApartados = process.argv[5] !== undefined ? parseInt(process.argv[5]) : undefined;

if (!referencia || isNaN(nuevoStock)) {
  console.log('Uso: node scripts/corregirProducto.cjs <REFERENCIA> <STOCK_TOTAL> [RES_PEDIDOS] [RES_APARTADOS]');
  console.log('Ejemplo: node scripts/corregirProducto.cjs MA019T8 5 1 0');
  process.exit(1);
}

corregirProducto(referencia, nuevoStock, resPedidos, resApartados)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
