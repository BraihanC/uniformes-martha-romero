import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// Configuración de Firebase (debe coincidir con tu proyecto)
const firebaseConfig = {
  apiKey: "AIzaSyDHI9tBPKO-2z3-o1lrXdXOo0tGVxiG0LU",
  authDomain: "pos-martha-romero.firebaseapp.com",
  projectId: "pos-martha-romero",
  storageBucket: "pos-martha-romero.firebasestorage.app",
  messagingSenderId: "537291463009",
  appId: "1:537291463009:web:2e0fff84ad2b19d98a5ef0"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteAllProducts() {
  try {
    console.log('🔍 Obteniendo todos los productos...');

    const productsSnapshot = await getDocs(collection(db, 'products'));
    const totalProducts = productsSnapshot.size;

    if (totalProducts === 0) {
      console.log('✅ No hay productos para eliminar.');
      process.exit(0);
    }

    console.log(`📦 Encontrados ${totalProducts} productos.`);
    console.log('⚠️  ¿Estás seguro de que deseas ELIMINAR TODOS los productos?');
    console.log('⚠️  Esta acción NO se puede deshacer.');
    console.log('');
    console.log('Presiona CTRL+C para cancelar o espera 5 segundos para continuar...');

    // Esperar 5 segundos antes de proceder
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Eliminando productos...');

    // Firestore tiene un límite de 500 operaciones por batch
    const batchSize = 500;
    let deletedCount = 0;

    // Dividir en lotes de 500
    const docs = productsSnapshot.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(i, i + batchSize);

      batchDocs.forEach((docSnapshot) => {
        batch.delete(doc(db, 'products', docSnapshot.id));
      });

      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`   Eliminados ${deletedCount}/${totalProducts} productos...`);
    }

    console.log('');
    console.log('✅ ¡Todos los productos han sido eliminados exitosamente!');
    console.log(`📊 Total eliminado: ${deletedCount} productos`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al eliminar productos:', error);
    process.exit(1);
  }
}

// Ejecutar la función
deleteAllProducts();
