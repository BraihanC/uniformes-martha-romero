// Script para corregir stockReservadoB2B de un producto
// Uso: node corregirStockB2B.cjs <productoId> <valor>
// Ejemplo: node corregirStockB2B.cjs kfZdB5kPEYQ8XO3ell81 2

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function corregirStockB2B() {
  const productoId = process.argv[2];
  const valor = parseInt(process.argv[3]);

  if (!productoId || isNaN(valor)) {
    console.log('Uso: node corregirStockB2B.cjs <productoId> <valor>');
    console.log('Ejemplo: node corregirStockB2B.cjs kfZdB5kPEYQ8XO3ell81 2');
    process.exit(1);
  }

  console.log(`\n=== CORREGIR stockReservadoB2B ===`);
  console.log(`Producto ID: ${productoId}`);
  console.log(`Nuevo valor: ${valor}`);

  // Obtener producto actual
  const productoRef = db.collection('products').doc(productoId);
  const productoDoc = await productoRef.get();

  if (!productoDoc.exists) {
    console.log(`\n❌ Producto no encontrado con ID: ${productoId}`);
    process.exit(1);
  }

  const producto = productoDoc.data();
  console.log(`\nProducto encontrado:`);
  console.log(`  - Nombre: ${producto.nombre}`);
  console.log(`  - Referencia: ${producto.referencia}`);
  console.log(`  - Talla: ${producto.talla}`);
  console.log(`  - stockTotal: ${producto.stockTotal || 0}`);
  console.log(`  - stockReservadoB2B actual: ${producto.stockReservadoB2B || 0}`);

  // Confirmar
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n¿Cambiar stockReservadoB2B de ${producto.stockReservadoB2B || 0} a ${valor}? (s/n): `, async (answer) => {
    if (answer.toLowerCase() === 's') {
      await productoRef.update({
        stockReservadoB2B: valor,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`\n✅ stockReservadoB2B actualizado a ${valor}`);
    } else {
      console.log('\n❌ Operación cancelada');
    }
    rl.close();
    process.exit(0);
  });
}

corregirStockB2B();
