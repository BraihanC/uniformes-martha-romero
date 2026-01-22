// Script para corregir stock negativo de un producto
// Uso: node corregirStockNegativo.cjs <productoId> <nuevoValor>
// Ejemplo: node corregirStockNegativo.cjs D2NLdea5c81czYw88QUl 0

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function corregirStock() {
  const productoId = process.argv[2];
  const nuevoValor = parseInt(process.argv[3]);

  if (!productoId || isNaN(nuevoValor)) {
    console.log('Uso: node corregirStockNegativo.cjs <productoId> <nuevoValor>');
    console.log('Ejemplo: node corregirStockNegativo.cjs D2NLdea5c81czYw88QUl 0');
    process.exit(1);
  }

  console.log(`\n=== CORREGIR STOCK TOTAL ===`);
  console.log(`Producto ID: ${productoId}`);
  console.log(`Nuevo valor: ${nuevoValor}`);

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
  console.log(`  - stockTotal actual: ${producto.stockTotal || 0}`);
  console.log(`  - stockReservadoPedidos: ${producto.stockReservadoPedidos || 0}`);
  console.log(`  - stockReservadoApartados: ${producto.stockReservadoApartados || 0}`);
  console.log(`  - stockReservadoB2B: ${producto.stockReservadoB2B || 0}`);

  // Confirmar
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n¿Cambiar stockTotal de ${producto.stockTotal || 0} a ${nuevoValor}? (s/n): `, async (answer) => {
    if (answer.toLowerCase() === 's') {
      await productoRef.update({
        stockTotal: nuevoValor,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`\n✅ stockTotal actualizado a ${nuevoValor}`);
    } else {
      console.log('\n❌ Operación cancelada');
    }
    rl.close();
    process.exit(0);
  });
}

corregirStock();
