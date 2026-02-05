/**
 * Script para restaurar stockTotal desde la base de datos de backup
 *
 * Este script:
 * 1. Lee todos los productos de la base de datos backup-temp-28ene
 * 2. Copia el stockTotal a la base de datos principal (default)
 * 3. NO modifica las reservas ni otros campos
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBpqOG1Uf3DlPV49cxUCJo0hQM3nYU0_Do",
  authDomain: "uniformes-martha-romero.firebaseapp.com",
  projectId: "uniformes-martha-romero",
  storageBucket: "uniformes-martha-romero.firebasestorage.app",
  messagingSenderId: "764481730858",
  appId: "1:764481730858:web:2dbd02c61f2b9f5bba23a6"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Conectar a ambas bases de datos
const dbBackup = getFirestore(app, 'backup-temp-28ene');  // Base de datos del backup
const dbPrincipal = getFirestore(app);  // Base de datos principal (default)

async function restaurarStock() {
  console.log('🔄 RESTAURACIÓN DE STOCK DESDE BACKUP');
  console.log('=====================================\n');

  try {
    // PASO 1: Leer productos del backup
    console.log('📦 PASO 1: Leyendo productos del backup...');
    const backupProductsSnapshot = await getDocs(collection(dbBackup, 'products'));

    if (backupProductsSnapshot.empty) {
      console.log('❌ No se encontraron productos en el backup');
      process.exit(1);
    }

    console.log(`   Productos encontrados en backup: ${backupProductsSnapshot.size}`);

    // Crear mapa de productos del backup
    const productosBackup = {};
    backupProductsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      productosBackup[docSnap.id] = {
        id: docSnap.id,
        referencia: data.referencia,
        talla: data.talla,
        nombre: data.nombre,
        stockTotal: data.stockTotal || 0
      };
    });

    // PASO 2: Leer productos de la base de datos principal
    console.log('\n📦 PASO 2: Leyendo productos de la base de datos principal...');
    const principalProductsSnapshot = await getDocs(collection(dbPrincipal, 'products'));
    console.log(`   Productos encontrados en principal: ${principalProductsSnapshot.size}`);

    // PASO 3: Comparar y preparar actualizaciones
    console.log('\n📦 PASO 3: Comparando y preparando actualizaciones...');

    let productosActualizados = 0;
    let productosSinCambios = 0;
    let productosNoEncontrados = 0;
    const cambios = [];

    // Usamos batch para actualizar en lotes (máximo 500 operaciones por batch)
    let batch = writeBatch(dbPrincipal);
    let batchCount = 0;

    for (const docSnap of principalProductsSnapshot.docs) {
      const productoId = docSnap.id;
      const productoPrincipal = docSnap.data();
      const productoBackup = productosBackup[productoId];

      if (!productoBackup) {
        // Producto no existe en el backup (fue creado después)
        productosNoEncontrados++;
        continue;
      }

      const stockActual = productoPrincipal.stockTotal || 0;
      const stockBackup = productoBackup.stockTotal || 0;

      if (stockActual !== stockBackup) {
        // Hay diferencia, actualizar
        const productoRef = doc(dbPrincipal, 'products', productoId);
        batch.update(productoRef, { stockTotal: stockBackup });

        cambios.push({
          referencia: productoPrincipal.referencia,
          talla: productoPrincipal.talla,
          nombre: productoPrincipal.nombre,
          stockAnterior: stockActual,
          stockRestaurado: stockBackup
        });

        productosActualizados++;
        batchCount++;

        // Firebase permite máximo 500 operaciones por batch
        if (batchCount >= 499) {
          console.log(`   Ejecutando batch de ${batchCount} operaciones...`);
          await batch.commit();
          batch = writeBatch(dbPrincipal);
          batchCount = 0;
        }
      } else {
        productosSinCambios++;
      }
    }

    // Ejecutar el último batch si tiene operaciones pendientes
    if (batchCount > 0) {
      console.log(`   Ejecutando batch final de ${batchCount} operaciones...`);
      await batch.commit();
    }

    // PASO 4: Mostrar resumen
    console.log('\n📊 RESUMEN DE RESTAURACIÓN:');
    console.log('===========================');
    console.log(`✅ Productos actualizados: ${productosActualizados}`);
    console.log(`⏸️  Productos sin cambios: ${productosSinCambios}`);
    console.log(`⚠️  Productos nuevos (no en backup): ${productosNoEncontrados}`);

    if (cambios.length > 0) {
      console.log('\n📝 DETALLE DE CAMBIOS:');
      console.log('----------------------');
      cambios.forEach(c => {
        console.log(`${c.referencia} ${c.talla}: ${c.stockAnterior} → ${c.stockRestaurado}`);
      });
    }

    console.log('\n✅ RESTAURACIÓN COMPLETADA EXITOSAMENTE');
    console.log('\n⚠️  IMPORTANTE: Ahora debes restar las ventas de hoy del inventario.');
    console.log('   Las ventas de hoy (501-504) deben descontarse manualmente o con otro script.');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

restaurarStock();
