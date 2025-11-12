/**
 * Script para limpiar la base de datos de Firebase
 *
 * ELIMINA:
 * - sales (ventas/facturas)
 * - apartados
 * - pedidos
 * - cambiosYDevoluciones
 * - products
 * - egresos
 * - entradas (si existe)
 *
 * MANTIENE:
 * - clients (clientes reales)
 * - colegios (catálogo)
 * - config (configuración de empresa)
 * - users (usuarios del sistema)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as readline from 'readline';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBvC89CFPDuSwhcSFeWNiSTz7cL0jHS-BE",
  authDomain: "pos-martha-romero.firebaseapp.com",
  projectId: "pos-martha-romero",
  storageBucket: "pos-martha-romero.firebasestorage.app",
  messagingSenderId: "1054353025977",
  appId: "1:1054353025977:web:51d02f93934eece4826468"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Colecciones a eliminar
const COLLECTIONS_TO_DELETE = [
  'sales',
  'apartados',
  'pedidos',
  'cambiosYDevoluciones',
  'products',
  'egresos',
  'entradas'
];

// Colecciones a mantener (solo para referencia)
const COLLECTIONS_TO_KEEP = [
  'clients',
  'colegios',
  'config',
  'users'
];

// Función para preguntar confirmación
function askConfirmation(question) {
  // Si se pasa --confirm como argumento, auto-confirmar
  if (process.argv.includes('--confirm')) {
    console.log(question + ' [AUTO-CONFIRMADO]');
    return Promise.resolve(true);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'si' || answer.toLowerCase() === 's');
    });
  });
}

// Función para eliminar una colección
async function deleteCollection(collectionName) {
  console.log(`\n🗑️  Eliminando colección: ${collectionName}...`);

  try {
    const snapshot = await getDocs(collection(db, collectionName));
    const totalDocs = snapshot.size;

    if (totalDocs === 0) {
      console.log(`   ℹ️  La colección '${collectionName}' está vacía o no existe.`);
      return 0;
    }

    console.log(`   📊 Encontrados ${totalDocs} documentos`);

    let deleted = 0;
    const batchSize = 10;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = snapshot.docs.slice(i, i + batchSize);
      await Promise.all(
        batch.map(docSnap => deleteDoc(doc(db, collectionName, docSnap.id)))
      );
      deleted += batch.length;
      process.stdout.write(`\r   ⏳ Eliminados ${deleted}/${totalDocs} documentos...`);
    }

    console.log(`\n   ✅ Colección '${collectionName}' eliminada completamente (${totalDocs} documentos)`);
    return totalDocs;
  } catch (error) {
    console.error(`   ❌ Error al eliminar '${collectionName}':`, error.message);
    return 0;
  }
}

// Función principal
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     🧹 LIMPIEZA DE BASE DE DATOS - FIREBASE FIRESTORE     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  ADVERTENCIA: Esta operación es IRREVERSIBLE\n');

  console.log('📋 Colecciones que se ELIMINARÁN:');
  COLLECTIONS_TO_DELETE.forEach(col => console.log(`   ❌ ${col}`));

  console.log('\n✅ Colecciones que se MANTENDRÁN:');
  COLLECTIONS_TO_KEEP.forEach(col => console.log(`   🔒 ${col}`));

  console.log('\n───────────────────────────────────────────────────────────\n');

  // Primera confirmación
  const confirm1 = await askConfirmation('¿Estás seguro de que quieres continuar? (escribe "si" para confirmar): ');

  if (!confirm1) {
    console.log('\n❌ Operación cancelada por el usuario.');
    process.exit(0);
  }

  // Segunda confirmación (seguridad adicional)
  const confirm2 = await askConfirmation('\n⚠️  ÚLTIMA CONFIRMACIÓN: ¿Realmente deseas ELIMINAR todos los datos de prueba? (escribe "si" para confirmar): ');

  if (!confirm2) {
    console.log('\n❌ Operación cancelada por el usuario.');
    process.exit(0);
  }

  console.log('\n🚀 Iniciando limpieza de base de datos...\n');

  const startTime = Date.now();
  let totalDeleted = 0;

  // Eliminar cada colección
  for (const collectionName of COLLECTIONS_TO_DELETE) {
    const deleted = await deleteCollection(collectionName);
    totalDeleted += deleted;
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    ✅ LIMPIEZA COMPLETADA                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Resumen:`);
  console.log(`   • Total de documentos eliminados: ${totalDeleted}`);
  console.log(`   • Tiempo de ejecución: ${duration} segundos`);
  console.log(`   • Colecciones limpiadas: ${COLLECTIONS_TO_DELETE.length}`);
  console.log('\n✅ La base de datos está lista para producción.');
  console.log('📌 Los consecutivos empezarán desde 1 automáticamente.\n');

  process.exit(0);
}

// Ejecutar
main().catch(error => {
  console.error('\n❌ Error crítico:', error);
  process.exit(1);
});
