/**
 * Script de Auditoría Completa del Inventario
 *
 * Compara el stockTotal registrado vs el calculado basándose en:
 * - Entradas de stock (stockEntries)
 * - Ventas (sales)
 * - Apartados entregados
 * - Pedidos entregados
 * - Stock inicial del producto
 *
 * Ejecutar con: node scripts/auditarInventarioCompleto.cjs
 */

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function auditarInventarioCompleto() {
  console.log('========================================');
  console.log('AUDITORÍA COMPLETA DEL INVENTARIO');
  console.log('========================================\n');

  try {
    // 1. Cargar todos los productos
    console.log('Cargando productos...');
    const productsSnapshot = await db.collection('products').get();
    const productos = {};
    productsSnapshot.docs.forEach(doc => {
      productos[doc.id] = {
        id: doc.id,
        ...doc.data(),
        // Contadores para auditoría
        entradas: 0,
        ventas: 0,
        apartadosEntregados: 0,
        pedidosEntregados: 0
      };
    });
    console.log(`Total productos: ${Object.keys(productos).length}`);

    // 2. Cargar todas las entradas de stock
    console.log('Cargando entradas de stock...');
    const stockEntriesSnapshot = await db.collection('stockEntries').get();
    console.log(`Total entradas: ${stockEntriesSnapshot.docs.length}`);

    stockEntriesSnapshot.docs.forEach(doc => {
      const entry = doc.data();
      const productId = entry.productId || entry.productoId;
      const cantidad = entry.cantidad || 0;

      if (productId && productos[productId]) {
        productos[productId].entradas += cantidad;
      }
    });

    // 3. Cargar todas las ventas
    console.log('Cargando ventas...');
    const salesSnapshot = await db.collection('sales').get();
    console.log(`Total ventas: ${salesSnapshot.docs.length}`);

    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          const productId = item.productoId || item.id;
          const cantidad = item.cantidad || 1;

          if (productId && productos[productId]) {
            productos[productId].ventas += cantidad;
          }
        });
      }
    });

    // 4. Cargar apartados
    console.log('Cargando apartados...');
    const apartadosSnapshot = await db.collection('apartados').get();
    console.log(`Total apartados: ${apartadosSnapshot.docs.length}`);

    apartadosSnapshot.docs.forEach(doc => {
      const apartado = doc.data();
      const entregado = apartado.estadoGeneral === 'Entregado';

      if (apartado.items && Array.isArray(apartado.items)) {
        apartado.items.forEach(item => {
          const productId = item.productoId || item.id;
          const cantidad = item.cantidad || 1;

          if (productId && productos[productId] && entregado) {
            productos[productId].apartadosEntregados += cantidad;
          }
        });
      }
    });

    // 5. Cargar pedidos
    console.log('Cargando pedidos...');
    const pedidosSnapshot = await db.collection('pedidos').get();
    console.log(`Total pedidos: ${pedidosSnapshot.docs.length}`);

    pedidosSnapshot.docs.forEach(doc => {
      const pedido = doc.data();

      if (pedido.items && Array.isArray(pedido.items)) {
        pedido.items.forEach(item => {
          const productId = item.productoId;
          const cantidadEntregada = item.cantidadEntregada || 0;

          if (productId && productos[productId]) {
            productos[productId].pedidosEntregados += cantidadEntregada;
          }
        });
      }
    });

    // 6. Calcular discrepancias
    console.log('\nCalculando discrepancias...\n');

    const discrepancias = [];
    let productosConDiscrepancia = 0;
    let productosCorrectos = 0;

    for (const [productId, producto] of Object.entries(productos)) {
      const stockActual = producto.stockTotal || 0;

      // CORRECCIÓN: El bug hacía que las ventas NO se restaran del stockTotal
      // Por lo tanto: stockActual = stock_real + ventas_no_descontadas
      // Stock corregido = stockActual - ventas (restamos las ventas que no se restaron)
      const ventasNoDescontadas = producto.ventas; // Todas las ventas no se descontaron
      const stockCorregido = Math.max(0, stockActual - ventasNoDescontadas);

      // La diferencia es cuánto hay de más por las ventas no descontadas
      const diferencia = stockActual - stockCorregido;

      // Solo reportar si hubo ventas (esas son las que no se descontaron)
      const huboVentas = producto.ventas > 0;

      if (diferencia !== 0 && huboVentas) {
        productosConDiscrepancia++;
        discrepancias.push({
          id: productId,
          referencia: producto.referencia || '',
          nombre: producto.nombre || '',
          talla: producto.talla || '',
          stockActual,
          stockCorregido,
          diferencia,
          entradas: producto.entradas,
          ventas: producto.ventas,
          apartadosEntregados: producto.apartadosEntregados,
          pedidosEntregados: producto.pedidosEntregados
        });
      } else if (huboVentas) {
        productosCorrectos++;
      }
    }

    // Ordenar por diferencia (mayor primero)
    discrepancias.sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

    // 7. Mostrar resultados
    console.log('========================================');
    console.log('RESULTADOS');
    console.log('========================================\n');

    console.log(`Productos con movimientos correctos: ${productosCorrectos}`);
    console.log(`Productos con discrepancias: ${productosConDiscrepancia}\n`);

    if (discrepancias.length > 0) {
      console.log('========================================');
      console.log('DISCREPANCIAS DETECTADAS');
      console.log('========================================\n');

      // Mostrar solo las primeras 50 para no llenar la consola
      const mostrar = discrepancias.slice(0, 50);

      console.log('REF\t\tNOMBRE\t\t\t\tACTUAL\tCORREGIDO\tDIF\tVENTAS');
      console.log('-'.repeat(100));

      for (const disc of mostrar) {
        const nombreCorto = disc.nombre.substring(0, 25).padEnd(25);
        const refCorta = disc.referencia.substring(0, 12).padEnd(12);
        console.log(
          `${refCorta}\t${nombreCorto}\t${disc.stockActual}\t${disc.stockCorregido}\t\t-${disc.diferencia}\t${disc.ventas}`
        );
      }

      if (discrepancias.length > 50) {
        console.log(`\n... y ${discrepancias.length - 50} más`);
      }

      // 8. Generar archivo de correcciones
      console.log('\n========================================');
      console.log('ARCHIVO DE CORRECCIONES');
      console.log('========================================\n');

      const fs = require('fs');
      const correcciones = discrepancias.map(d => ({
        id: d.id,
        referencia: d.referencia,
        nombre: d.nombre,
        stockActual: d.stockActual,
        stockCorregido: d.stockCorregido,
        diferencia: d.diferencia
      }));

      const archivoPath = path.join(__dirname, 'correcciones_inventario.json');
      fs.writeFileSync(archivoPath, JSON.stringify(correcciones, null, 2));
      console.log(`Archivo de correcciones guardado en: ${archivoPath}`);

      // Calcular impacto total
      let stockExcedente = 0;
      let stockFaltante = 0;
      discrepancias.forEach(d => {
        if (d.diferencia > 0) stockExcedente += d.diferencia;
        else stockFaltante += Math.abs(d.diferencia);
      });

      console.log(`\nIMPACTO TOTAL:`);
      console.log(`  Stock excedente (sistema cree que hay más): +${stockExcedente} unidades`);
      console.log(`  Stock faltante (sistema cree que hay menos): -${stockFaltante} unidades`);
    }

    console.log('\n========================================');
    console.log('AUDITORÍA COMPLETADA');
    console.log('========================================');

    return {
      totalProductos: Object.keys(productos).length,
      productosCorrectos,
      productosConDiscrepancia,
      discrepancias
    };

  } catch (error) {
    console.error('Error durante la auditoría:', error);
    throw error;
  }
}

auditarInventarioCompleto()
  .then(resultado => {
    console.log(`\nDiscrepancias encontradas: ${resultado.discrepancias.length}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
