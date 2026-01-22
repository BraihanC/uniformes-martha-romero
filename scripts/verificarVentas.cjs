/**
 * Script para verificar las ventas de un producto específico
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

async function verificarVentas(numFacturas) {
  console.log('========================================');
  console.log('VERIFICAR VENTAS');
  console.log('========================================\n');

  for (const numFactura of numFacturas) {
    console.log(`\n--- FACTURA #${numFactura} ---`);

    const salesQuery = await db.collection('sales')
      .where('numeroFactura', '==', numFactura)
      .get();

    if (salesQuery.empty) {
      console.log('No encontrada');
      continue;
    }

    const sale = salesQuery.docs[0].data();
    const fecha = sale.createdAt?.toDate?.() || 'Sin fecha';
    console.log(`Fecha: ${fecha instanceof Date ? fecha.toLocaleString('es-CO') : fecha}`);
    console.log(`Cliente: ${sale.clienteNombre || 'N/A'}`);
    console.log(`Total: $${sale.totalPagado?.toLocaleString('es-CO') || 'N/A'}`);
    console.log('Items:');

    if (sale.items && Array.isArray(sale.items)) {
      for (const item of sale.items) {
        console.log(`  - ${item.nombre || 'Sin nombre'}`);
        console.log(`    Ref: ${item.referencia || 'N/A'}`);
        console.log(`    ID Producto: ${item.productoId || item.id || 'SIN ID!'}`);
        console.log(`    Cantidad: ${item.cantidad}`);
        console.log(`    Precio: $${item.precioUnitario?.toLocaleString('es-CO') || 'N/A'}`);
      }
    }
  }
}

// Facturas a verificar
const facturas = [165, 201, 223];
verificarVentas(facturas)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
