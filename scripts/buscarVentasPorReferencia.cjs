// Script para buscar ventas por referencia del producto
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function buscarVentas() {
  const referencia = process.argv[2] || 'RIBUDIA12';
  const talla = process.argv[3] || '12';

  console.log(`\n=== BUSCANDO VENTAS POR REFERENCIA ===`);
  console.log(`Referencia: ${referencia}`);
  console.log(`Talla: ${talla}\n`);

  // Buscar en todas las ventas
  const salesSnap = await db.collection('sales').get();
  console.log(`Total de ventas en la colección: ${salesSnap.size}\n`);

  let ventasEncontradas = 0;

  for (const saleDoc of salesSnap.docs) {
    const sale = saleDoc.data();
    const productos = sale.productos || sale.items || [];

    for (const p of productos) {
      // Buscar por múltiples campos posibles
      const matchReferencia = p.referencia === referencia ||
                              p.codigo === referencia ||
                              (p.referencia && p.referencia.includes('RIBUDIA')) ||
                              (p.nombre && p.nombre.includes('RICURTE'));

      const matchTalla = p.talla === talla || p.talla === '12';

      if (matchReferencia) {
        ventasEncontradas++;
        const fecha = sale.createdAt?.toDate?.() || sale.fecha?.toDate?.() || 'Sin fecha';
        console.log(`--- VENTA ENCONTRADA ---`);
        console.log(`  Fecha: ${fecha}`);
        console.log(`  Venta ID: ${saleDoc.id}`);
        console.log(`  Producto:`);
        console.log(`    - ID: ${p.id || p.productId || 'N/A'}`);
        console.log(`    - Nombre: ${p.nombre || 'N/A'}`);
        console.log(`    - Referencia: ${p.referencia || p.codigo || 'N/A'}`);
        console.log(`    - Talla: ${p.talla || 'N/A'}`);
        console.log(`    - Cantidad: ${p.cantidad || 1}`);
        console.log(`    - Precio: ${p.precio || p.precioUnitario || 'N/A'}`);
        console.log(``);
      }
    }
  }

  if (ventasEncontradas === 0) {
    console.log(`No se encontraron ventas con esta referencia.`);

    // Mostrar ejemplo de estructura de una venta
    if (salesSnap.size > 0) {
      console.log(`\n--- EJEMPLO DE ESTRUCTURA DE VENTA ---`);
      const ejemploVenta = salesSnap.docs[0].data();
      const ejemploProducto = (ejemploVenta.productos || ejemploVenta.items || [])[0];
      if (ejemploProducto) {
        console.log(`Campos de producto en venta:`);
        Object.keys(ejemploProducto).forEach(key => {
          console.log(`  - ${key}: ${ejemploProducto[key]}`);
        });
      }
    }
  }

  console.log(`\n=== TOTAL VENTAS ENCONTRADAS: ${ventasEncontradas} ===\n`);
}

buscarVentas()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
