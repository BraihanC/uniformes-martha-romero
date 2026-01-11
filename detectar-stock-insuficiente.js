// ========================================
// SCRIPT DE DETECCIÓN - STOCK INSUFICIENTE
// Detecta productos donde stockTotal < stockReservadoPedidos
// (Es físicamente imposible tener más reservado que stock físico)
// ========================================

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
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

console.log('========================================');
console.log('DETECCIÓN DE STOCK FÍSICO INSUFICIENTE');
console.log('stockTotal < stockReservadoPedidos');
console.log('========================================\n');

async function detectarStockInsuficiente() {
  try {
    console.log('📊 Leyendo inventario completo...\n');
    const productosSnapshot = await db.collection('products').get();

    const productosProblema = [];
    let totalProductos = 0;

    for (const productoDoc of productosSnapshot.docs) {
      const producto = productoDoc.data();
      totalProductos++;

      const stockTotal = producto.stockTotal || 0;
      const stockReservadoPedidos = producto.stockReservadoPedidos || 0;
      const stockReservadoApartados = producto.stockReservadoApartados || 0;

      const totalReservado = stockReservadoPedidos + stockReservadoApartados;

      // Detectar problema: más reservado que stock físico
      if (stockTotal < totalReservado) {
        const faltante = totalReservado - stockTotal;

        productosProblema.push({
          id: productoDoc.id,
          nombre: producto.nombre || 'Sin nombre',
          referencia: producto.referencia || 'N/A',
          talla: producto.talla || 'N/A',
          stockTotal: stockTotal,
          reservadoPedidos: stockReservadoPedidos,
          reservadoApartados: stockReservadoApartados,
          totalReservado: totalReservado,
          faltante: faltante
        });
      }
    }

    // Mostrar resultados
    console.log('='.repeat(80));

    if (productosProblema.length === 0) {
      console.log('\n✅ ¡PERFECTO! No se encontraron productos con stock insuficiente');
      console.log(`   Todos los ${totalProductos} productos tienen stock físico adecuado\n`);
    } else {
      console.log(`\n⚠️  PROBLEMA DETECTADO: ${productosProblema.length} productos`);
      console.log('   Tienen menos stock físico del que está reservado\n');
      console.log('='.repeat(80));

      // Ordenar por magnitud del faltante
      productosProblema.sort((a, b) => b.faltante - a.faltante);

      for (const producto of productosProblema) {
        console.log(`\n🚨 ${producto.nombre}`);
        console.log(`   Ref: ${producto.referencia} | Talla: ${producto.talla}`);
        console.log(`   ID: ${producto.id}`);
        console.log(`\n   📦 Stock Físico Total: ${producto.stockTotal}`);
        console.log(`   🔒 Reservado Pedidos: ${producto.reservadoPedidos}`);

        if (producto.reservadoApartados > 0) {
          console.log(`   🔒 Reservado Apartados: ${producto.reservadoApartados}`);
        }

        console.log(`   🔒 Total Reservado: ${producto.totalReservado}`);
        console.log(`\n   ❌ FALTAN: ${producto.faltante} unidad(es) en stock físico`);
        console.log(`   💡 Debería tener: ${producto.totalReservado} unidades en stock`);
        console.log('-'.repeat(80));
      }

      // Resumen y recomendaciones
      console.log('\n' + '='.repeat(80));
      console.log('RESUMEN Y RECOMENDACIONES');
      console.log('='.repeat(80));
      console.log(`⚠️  Total productos con problema: ${productosProblema.length}`);
      console.log(`✅ Productos correctos: ${totalProductos - productosProblema.length}`);

      console.log('\n📝 SOLUCIONES POSIBLES:\n');

      console.log('1️⃣  AJUSTE MANUAL (Más rápido):');
      console.log('   • Ve a Inventario → Busca el producto → Editar');
      console.log('   • Cambia "Stock Total" al valor correcto');
      console.log('   • Guarda');

      console.log('\n2️⃣  DAR ENTRADA (Si los productos llegaron):');
      console.log('   • Ve a Entrada de Satélites');
      console.log('   • Da entrada a las unidades faltantes');
      console.log('   • El sistema las asignará automáticamente');

      console.log('\n3️⃣  VERIFICAR FÍSICAMENTE:');
      console.log('   • Cuenta las prendas en las bolsas de pedidos');
      console.log('   • Si físicamente tienes las unidades, haz ajuste manual');
      console.log('   • Si NO las tienes, investiga qué pasó');

      console.log('\n⚠️  IMPORTANTE:');
      console.log('   Estos productos tienen MÁS pedidos/apartados de lo que existe');
      console.log('   físicamente en bodega. Esto puede causar problemas al entregar.');

      console.log('='.repeat(80));
    }

    console.log('\n✅ Análisis completado\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }

  process.exit(0);
}

// Ejecutar
detectarStockInsuficiente();
