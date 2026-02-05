/**
 * Script de diagnóstico: Verificar y corregir stockTotal de un producto
 *
 * Este script:
 * 1. Busca el producto por referencia y talla
 * 2. Lee todas las entradas de stockEntries para ese producto
 * 3. Suma las cantidades de las entradas
 * 4. Compara con el stockTotal actual
 * 5. Opcionalmente corrige el stockTotal
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';

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
const db = getFirestore(app);

// ============================================
// CONFIGURACIÓN - MODIFICAR SEGÚN EL PRODUCTO
// ============================================
const REFERENCIA = 'PRE002T10';
const TALLA = '10';
const CORREGIR = true; // Cambiar a true para corregir el stockTotal
// ============================================

async function diagnosticarStock() {
  console.log('🔍 DIAGNÓSTICO DE STOCK');
  console.log('========================');
  console.log(`Producto: ${REFERENCIA} - Talla: ${TALLA}`);
  console.log('');

  try {
    // 1. Buscar el producto
    console.log('1️⃣ Buscando producto...');
    const productsRef = collection(db, 'products');
    const productQuery = query(
      productsRef,
      where('referencia', '==', REFERENCIA),
      where('talla', '==', TALLA)
    );
    const productSnapshot = await getDocs(productQuery);

    if (productSnapshot.empty) {
      console.log('❌ Producto no encontrado');
      process.exit(1);
    }

    const productDoc = productSnapshot.docs[0];
    const product = productDoc.data();
    const productId = productDoc.id;

    console.log(`   ✅ Producto encontrado: ${product.nombre}`);
    console.log(`   📋 ID: ${productId}`);
    console.log(`   📊 Stock actual en BD:`);
    console.log(`      - stockTotal: ${product.stockTotal || 0}`);
    console.log(`      - stockReservadoPedidos: ${product.stockReservadoPedidos || 0}`);
    console.log(`      - stockReservadoApartados: ${product.stockReservadoApartados || 0}`);
    console.log(`      - stockReservadoB2B: ${product.stockReservadoB2B || 0}`);

    const disponibleCalculado = (product.stockTotal || 0) -
                                 (product.stockReservadoPedidos || 0) -
                                 (product.stockReservadoApartados || 0) -
                                 (product.stockReservadoB2B || 0);
    console.log(`      - Stock disponible calculado: ${disponibleCalculado}`);
    console.log('');

    // 2. Buscar todas las entradas del producto
    console.log('2️⃣ Buscando entradas en stockEntries...');
    const entriesRef = collection(db, 'stockEntries');

    // Buscar por productId
    const entriesByIdQuery = query(entriesRef, where('productId', '==', productId));
    const entriesByIdSnapshot = await getDocs(entriesByIdQuery);

    // También buscar por referencia (por si hay inconsistencias)
    const entriesByRefQuery = query(entriesRef, where('referencia', '==', REFERENCIA));
    const entriesByRefSnapshot = await getDocs(entriesByRefQuery);

    // Combinar y deduplicar
    const entriesMap = new Map();

    entriesByIdSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.talla === TALLA || data.talla === 'Única') {
        entriesMap.set(doc.id, { id: doc.id, ...data });
      }
    });

    entriesByRefSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.talla === TALLA || data.talla === 'Única') {
        entriesMap.set(doc.id, { id: doc.id, ...data });
      }
    });

    const entries = Array.from(entriesMap.values());
    console.log(`   📦 Entradas encontradas: ${entries.length}`);
    console.log('');

    // 3. Analizar cada entrada
    console.log('3️⃣ Detalle de entradas:');
    let totalEntradas = 0;
    let totalDefectuosas = 0;
    let totalBuenas = 0;

    entries.forEach((entry, index) => {
      const fecha = entry.createdAt?.toDate?.() || entry.fecha?.toDate?.() || 'Sin fecha';
      const fechaStr = fecha instanceof Date ? fecha.toLocaleDateString('es-CO') : fecha;
      const cantidad = entry.cantidad || 0;
      const defectuosas = entry.cantidadDefectuosa || 0;
      const buenas = cantidad - defectuosas;

      console.log(`   ${index + 1}. Fecha: ${fechaStr}`);
      console.log(`      Tipo: ${entry.tipoEntrada || 'N/A'}`);
      console.log(`      Cantidad total: ${cantidad}`);
      console.log(`      Defectuosas: ${defectuosas}`);
      console.log(`      Buenas (suman al stock): ${buenas}`);
      console.log(`      ProductId guardado: ${entry.productId || 'N/A'}`);
      console.log('');

      totalEntradas += cantidad;
      totalDefectuosas += defectuosas;
      totalBuenas += buenas;
    });

    console.log('4️⃣ RESUMEN:');
    console.log(`   Total prendas ingresadas: ${totalEntradas}`);
    console.log(`   Total defectuosas: ${totalDefectuosas}`);
    console.log(`   Total buenas (deben estar en stock): ${totalBuenas}`);
    console.log(`   StockTotal actual en BD: ${product.stockTotal || 0}`);
    console.log('');

    const diferencia = totalBuenas - (product.stockTotal || 0);

    if (diferencia === 0) {
      console.log('✅ No hay descuadre en stockTotal');
    } else if (diferencia > 0) {
      console.log(`⚠️ DESCUADRE DETECTADO: Faltan ${diferencia} unidades en stockTotal`);
    } else {
      console.log(`⚠️ DESCUADRE DETECTADO: Sobran ${Math.abs(diferencia)} unidades en stockTotal`);
    }
    console.log('');

    // 5. Corregir si está habilitado
    if (CORREGIR && diferencia !== 0) {
      console.log('5️⃣ CORRIGIENDO stockTotal...');

      await updateDoc(doc(db, 'products', productId), {
        stockTotal: totalBuenas
      });

      console.log(`   ✅ stockTotal actualizado de ${product.stockTotal || 0} a ${totalBuenas}`);

      const nuevoDisponible = totalBuenas -
                              (product.stockReservadoPedidos || 0) -
                              (product.stockReservadoApartados || 0) -
                              (product.stockReservadoB2B || 0);
      console.log(`   📊 Nuevo stock disponible: ${nuevoDisponible}`);
    } else if (!CORREGIR && diferencia !== 0) {
      console.log('ℹ️ Para corregir, cambia CORREGIR = true en el script');
    }

    console.log('');
    console.log('✅ Diagnóstico completado');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnosticarStock();
