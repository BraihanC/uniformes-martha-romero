// Verificar estado actual de CAMISETA MA DEP TALLA 16

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
} catch (error) {
  console.error('ERROR: No se encontró serviceAccountKey.json');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verificarProducto() {
  try {
    const REFERENCIA = 'MA011T16';

    console.log('========================================');
    console.log('VERIFICANDO: CAMISETA MA DEP TALLA 16');
    console.log(`Referencia: ${REFERENCIA}`);
    console.log('========================================\n');

    const productosSnapshot = await db.collection('products').get();

    for (const doc of productosSnapshot.docs) {
      const producto = doc.data();

      if (producto.referencia === REFERENCIA) {
        console.log('✅ PRODUCTO ENCONTRADO\n');
        console.log(`ID: ${doc.id}`);
        console.log(`Nombre: ${producto.nombre || 'N/A'}`);
        console.log(`Referencia: ${producto.referencia || 'N/A'}`);
        console.log(`Talla: ${producto.talla || 'N/A'}`);
        console.log(`\n📦 INVENTARIO:`);
        console.log(`   Stock Total: ${producto.stockTotal || 0}`);
        console.log(`   Stock Reservado Pedidos: ${producto.stockReservadoPedidos || 0}`);
        console.log(`   Stock Reservado Apartados: ${producto.stockReservadoApartados || 0}`);
        console.log(`   Total Prendas Pedidas: ${producto.totalPrendasPedidas || 0}`);

        const disponible = (producto.stockTotal || 0) - (producto.stockReservadoPedidos || 0) - (producto.stockReservadoApartados || 0);
        console.log(`\n   💰 Stock Disponible para Venta: ${disponible}`);

        if (disponible < 0) {
          console.log(`\n   ⚠️  PROBLEMA: Stock disponible negativo!`);
        } else {
          console.log(`\n   ✅ Stock disponible OK`);
        }

        console.log('\n========================================');
        process.exit(0);
      }
    }

    console.log('❌ No se encontró el producto con referencia ' + REFERENCIA);

  } catch (error) {
    console.error('ERROR:', error);
  }

  process.exit(0);
}

verificarProducto();
