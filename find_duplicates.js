// Script temporal para encontrar apartados duplicados
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

// Tu configuración de Firebase (copia de src/services/firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyDQOd2gfP_JRkY5UYfuYXSs3QGLmL3oY7c",
  authDomain: "uniformes-martha-romero.firebaseapp.com",
  projectId: "uniformes-martha-romero",
  storageBucket: "uniformes-martha-romero.firebasestorage.app",
  messagingSenderId: "815815893726",
  appId: "1:815815893726:web:a9d6b7e0c1d4c3f8e2a9b6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findDuplicates() {
  try {
    // Buscar apartados con numeroApartado = 5
    const q = query(collection(db, 'apartados'), where('numeroApartado', '==', 5));
    const snapshot = await getDocs(q);
    
    console.log(`\n📊 Apartados con número 5 encontrados: ${snapshot.docs.length}\n`);
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`--- Apartado #${index + 1} ---`);
      console.log(`ID del documento: ${doc.id}`);
      console.log(`Cliente: ${data.clienteNombre}`);
      console.log(`Total: $${data.total?.toLocaleString()}`);
      console.log(`Estado: ${data.estadoGeneral}`);
      console.log(`Creado: ${data.createdAt?.toDate?.()}`);
      console.log(`Productos: ${data.items?.length || 0}`);
      console.log('');
    });
    
    console.log('💡 Para eliminar un duplicado:');
    console.log('1. Ve a Firebase Console: https://console.firebase.google.com');
    console.log('2. Proyecto: uniformes-martha-romero');
    console.log('3. Firestore Database > apartados');
    console.log('4. Busca el ID del documento que quieres eliminar');
    console.log('5. Elimínalo directamente desde la consola\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

findDuplicates();
