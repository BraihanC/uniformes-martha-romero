/**
 * SCRIPT PARA EJECUTAR EN LA CONSOLA DEL NAVEGADOR
 *
 * Instrucciones:
 * 1. Abre la aplicación en el navegador y asegúrate de estar logueado
 * 2. Abre las herramientas de desarrollador (F12)
 * 3. Ve a la pestaña "Console"
 * 4. Copia y pega TODO este código
 * 5. Presiona Enter para ejecutar
 */

(async function actualizarCostosEntradas() {
  // Importar funciones de Firestore desde el módulo global
  const {
    collection,
    getDocs,
    doc,
    writeBatch,
    query,
    where
  } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');

  // Obtener la instancia de db desde window (expuesta por la app)
  const db = window.db || (await import('/src/services/firebase.js')).db;

  if (!db) {
    console.error('❌ No se pudo acceder a la base de datos. Asegúrate de estar en la aplicación.');
    return;
  }

  console.log('='.repeat(60));
  console.log('ACTUALIZACIÓN DE COSTOS EN ENTRADAS DE SATÉLITE');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. Obtener TODAS las entradas de satélite
    console.log('🔍 Buscando entradas de satélite...');
    const entradasSnapshot = await getDocs(
      query(collection(db, 'stockEntries'), where('tipoEntrada', '==', 'satelite'))
    );

    console.log(`📦 Total de entradas de satélite: ${entradasSnapshot.size}`);

    // 2. Filtrar las que tienen costo 0 o undefined
    const entradasSinCosto = [];
    const entradasConCosto = [];

    entradasSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const costoTotal = data.costoTotal || 0;

      if (costoTotal === 0) {
        entradasSinCosto.push({ id: docSnap.id, ...data });
      } else {
        entradasConCosto.push({ id: docSnap.id, ...data });
      }
    });

    console.log(`✅ Entradas CON costo: ${entradasConCosto.length}`);
    console.log(`⚠️  Entradas SIN costo: ${entradasSinCosto.length}`);
    console.log('');

    if (entradasSinCosto.length === 0) {
      console.log('🎉 ¡No hay entradas que necesiten actualización!');
      return;
    }

    // 3. Obtener todos los productos para buscar costos
    console.log('📋 Obteniendo productos...');
    const productosSnapshot = await getDocs(collection(db, 'products'));
    const productosMap = new Map();

    productosSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      productosMap.set(docSnap.id, data);
      // También indexar por referencia para búsqueda alternativa
      if (data.referencia) {
        productosMap.set(`ref_${data.referencia}_${data.talla || ''}`, data);
      }
    });

    console.log(`📋 Productos cargados: ${productosSnapshot.size}`);
    console.log('');

    // 4. Preparar actualizaciones
    const actualizaciones = [];
    const sinCostoSatelite = [];
    const sinProducto = [];

    console.log('-'.repeat(60));
    console.log('DETALLE DE ENTRADAS A ACTUALIZAR:');
    console.log('-'.repeat(60));

    for (const entrada of entradasSinCosto) {
      // Buscar producto por ID o por referencia
      let producto = productosMap.get(entrada.productId);

      if (!producto && entrada.referencia) {
        // Buscar por referencia + talla
        producto = productosMap.get(`ref_${entrada.referencia}_${entrada.talla || ''}`);
      }

      if (!producto) {
        sinProducto.push(entrada);
        console.log(`❌ ${entrada.nombre || entrada.referencia}: Producto no encontrado`);
        continue;
      }

      const costoSatelite = producto.costoSatelite || 0;

      if (costoSatelite === 0) {
        sinCostoSatelite.push({ entrada, producto });
        console.log(`⚠️  ${entrada.nombre || entrada.referencia}: Sin costoSatelite configurado`);
        continue;
      }

      const cantidad = entrada.cantidad || 0;
      const nuevoCostoTotal = costoSatelite * cantidad;

      actualizaciones.push({
        entrada,
        producto,
        costoUnitario: costoSatelite,
        costoTotal: nuevoCostoTotal
      });

      const estado = entrada.pagado ? '💰 PAGADA' : '⏳ Pendiente';
      console.log(`✅ ${entrada.nombre || entrada.referencia} (${estado})`);
      console.log(`   Cantidad: ${cantidad} x $${costoSatelite.toLocaleString()} = $${nuevoCostoTotal.toLocaleString()}`);
    }

    console.log('');
    console.log('-'.repeat(60));
    console.log('RESUMEN:');
    console.log('-'.repeat(60));
    console.log(`✅ Listas para actualizar: ${actualizaciones.length}`);
    console.log(`❌ Sin producto encontrado: ${sinProducto.length}`);
    console.log(`⚠️  Sin costoSatelite: ${sinCostoSatelite.length}`);

    if (actualizaciones.length === 0) {
      console.log('');
      console.log('⚠️  No hay entradas que se puedan actualizar.');

      if (sinCostoSatelite.length > 0) {
        console.log('');
        console.log('📋 Productos que necesitan costoSatelite:');
        const productosUnicos = new Set();
        sinCostoSatelite.forEach(({ entrada }) => {
          const key = entrada.referencia || entrada.nombre;
          if (!productosUnicos.has(key)) {
            productosUnicos.add(key);
            console.log(`   - ${key}`);
          }
        });
      }
      return;
    }

    const totalAPagar = actualizaciones.reduce((sum, a) => sum + a.costoTotal, 0);
    console.log('');
    console.log(`💰 Total después de actualización: $${totalAPagar.toLocaleString()}`);
    console.log('');

    // 5. Confirmar
    const confirmar = confirm(
      `¿Actualizar ${actualizaciones.length} entradas?\n\n` +
      `Total a registrar: $${totalAPagar.toLocaleString()}\n\n` +
      `Esta acción actualizará los costos en las entradas pendientes y pagadas.`
    );

    if (!confirmar) {
      console.log('❌ Operación cancelada.');
      return;
    }

    // 6. Aplicar actualizaciones
    console.log('');
    console.log('🔄 Aplicando actualizaciones...');

    // Firebase tiene límite de 500 operaciones por batch
    const batchSize = 400;
    let processed = 0;

    for (let i = 0; i < actualizaciones.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = actualizaciones.slice(i, i + batchSize);

      for (const { entrada, costoUnitario, costoTotal } of chunk) {
        const entradaRef = doc(db, 'stockEntries', entrada.id);
        batch.update(entradaRef, {
          costoUnitario,
          costoTotal
        });
      }

      await batch.commit();
      processed += chunk.length;
      console.log(`   Procesadas: ${processed}/${actualizaciones.length}`);
    }

    // 7. Actualizar transacciones asociadas
    console.log('');
    console.log('🔄 Actualizando transacciones asociadas...');

    for (const { entrada, costoUnitario, costoTotal } of actualizaciones) {
      const transQuery = query(
        collection(db, 'transactions'),
        where('entradaId', '==', entrada.id),
        where('tipo', '==', 'entrada_satelite')
      );
      const transSnapshot = await getDocs(transQuery);

      if (!transSnapshot.empty) {
        const batch = writeBatch(db);
        transSnapshot.docs.forEach(transDoc => {
          const transRef = doc(db, 'transactions', transDoc.id);
          batch.update(transRef, {
            monto: -costoTotal,
            costoUnitario
          });
        });
        await batch.commit();
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ ACTUALIZACIÓN COMPLETADA');
    console.log('='.repeat(60));
    console.log(`   Entradas actualizadas: ${actualizaciones.length}`);
    console.log(`   Total registrado: $${totalAPagar.toLocaleString()}`);
    console.log('');
    console.log('🔄 Recarga la página para ver los cambios.');

  } catch (error) {
    console.error('❌ ERROR:', error);
  }
})();
