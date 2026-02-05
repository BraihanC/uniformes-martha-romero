/**
 * SCRIPT DE DIAGNÓSTICO PARA PEDIDOS B2B
 *
 * Instrucciones:
 * 1. Abre la aplicación en el navegador y asegúrate de estar logueado
 * 2. Abre las herramientas de desarrollador (F12)
 * 3. Ve a la pestaña "Console"
 * 4. Copia y pega TODO este código
 * 5. Presiona Enter para ejecutar
 *
 * Este script te mostrará:
 * - Estado real de cada producto en el pedido (según Firebase)
 * - Productos con sobrecumplimiento
 * - Discrepancias entre lo pedido y lo alistado
 */

(async function diagnosticarPedidoB2B() {
  // Importar funciones de Firestore
  const {
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    orderBy
  } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');

  // Obtener la instancia de db
  const db = window.db || (await import('/src/services/firebase.js')).db;

  if (!db) {
    console.error('❌ No se pudo acceder a la base de datos.');
    return;
  }

  console.log('='.repeat(70));
  console.log('DIAGNÓSTICO DE PEDIDOS B2B');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Listar todos los pedidos B2B
    console.log('📋 Cargando pedidos B2B...');
    const pedidosSnapshot = await getDocs(
      query(collection(db, 'pedidos_b2b'), orderBy('numeroPedido', 'desc'))
    );

    if (pedidosSnapshot.empty) {
      console.log('⚠️  No se encontraron pedidos B2B');
      return;
    }

    const pedidos = pedidosSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Se encontraron ${pedidos.length} pedidos B2B`);
    console.log('');
    console.log('-'.repeat(70));
    console.log('LISTA DE PEDIDOS:');
    console.log('-'.repeat(70));

    pedidos.forEach((pedido, idx) => {
      const numPedido = String(pedido.numeroPedido || 0).padStart(4, '0');
      const estado = pedido.estado || 'Sin estado';
      const cliente = pedido.clienteNombre || 'Sin cliente';
      const totalProductos = pedido.productos?.length || 0;

      console.log(`${idx + 1}. Pedido #${numPedido} - ${cliente}`);
      console.log(`   Estado: ${estado} | Productos: ${totalProductos}`);

      // Calcular totales
      if (pedido.productos && pedido.productos.length > 0) {
        const totales = pedido.productos.reduce((acc, p) => {
          acc.pedidas += p.cantidad || 0;
          acc.alistadas += p.cantidadAlistada || 0;
          acc.enviadas += p.cantidadEnviada || 0;
          acc.recibidas += p.cantidadRecibida || 0;
          return acc;
        }, { pedidas: 0, alistadas: 0, enviadas: 0, recibidas: 0 });

        console.log(`   Total: ${totales.pedidas} pedidas | ${totales.alistadas} alistadas | ${totales.enviadas} enviadas | ${totales.recibidas} recibidas`);
      }
    });

    console.log('');
    console.log('-'.repeat(70));

    // Preguntar cuál pedido quiere diagnosticar
    const numeroPedido = prompt(
      'Ingresa el número de pedido que quieres diagnosticar (ej: 1, 2, 3):\n' +
      'O presiona Cancelar para ver todos los pedidos'
    );

    if (!numeroPedido) {
      console.log('ℹ️  Mostrando diagnóstico de todos los pedidos...');
      console.log('');
    }

    const pedidosFiltrados = numeroPedido
      ? pedidos.filter(p => p.numeroPedido === parseInt(numeroPedido))
      : pedidos;

    if (pedidosFiltrados.length === 0) {
      console.log(`❌ No se encontró el pedido #${numeroPedido}`);
      return;
    }

    // Diagnosticar cada pedido
    for (const pedido of pedidosFiltrados) {
      console.log('='.repeat(70));
      console.log(`PEDIDO #${String(pedido.numeroPedido || 0).padStart(4, '0')}`);
      console.log('='.repeat(70));
      console.log('');
      console.log(`Cliente: ${pedido.clienteNombre || 'N/A'}`);
      console.log(`Colegio: ${pedido.codigoColegio || 'N/A'}`);
      console.log(`Estado: ${pedido.estado || 'N/A'}`);
      console.log(`Total Pedido: $${(pedido.total || 0).toLocaleString()}`);
      console.log('');
      console.log('-'.repeat(70));
      console.log('DETALLE DE PRODUCTOS:');
      console.log('-'.repeat(70));
      console.log('');

      if (!pedido.productos || pedido.productos.length === 0) {
        console.log('⚠️  Este pedido no tiene productos');
        continue;
      }

      let hayProblemas = false;
      const problemas = {
        sobrecumplimiento: [],
        discrepancias: [],
        sinAlistar: []
      };

      pedido.productos.forEach((producto, idx) => {
        const cantidadPedida = producto.cantidad || 0;
        const cantidadAlistada = producto.cantidadAlistada || 0;
        const cantidadEnviada = producto.cantidadEnviada || 0;
        const cantidadRecibida = producto.cantidadRecibida || 0;
        const pendiente = Math.max(0, cantidadPedida - cantidadAlistada);
        const sobrecumplimiento = Math.max(0, cantidadAlistada - cantidadPedida);
        const hayDiscrepancia = cantidadRecibida > 0 && cantidadRecibida < cantidadEnviada;

        console.log(`${idx + 1}. ${producto.descripcion || 'Sin descripción'}`);
        console.log(`   Talla: ${producto.talla || 'N/A'} | Código: ${producto.codigo || 'N/A'}`);
        console.log(`   Estado: ${producto.estadoProduccion || 'Sin estado'}`);
        console.log('');
        console.log(`   📦 Pedidas:    ${cantidadPedida}`);
        console.log(`   ✅ Alistadas:  ${cantidadAlistada}`);
        console.log(`   📤 Enviadas:   ${cantidadEnviada}`);
        console.log(`   📥 Recibidas:  ${cantidadRecibida}`);
        console.log(`   ⏳ Pendientes: ${pendiente}`);

        // Detectar problemas
        if (sobrecumplimiento > 0) {
          console.log(`   ⚠️  SOBRECUMPLIMIENTO: Se alistaron ${sobrecumplimiento} unidades de más`);
          problemas.sobrecumplimiento.push({
            producto: producto.descripcion,
            talla: producto.talla,
            pedidas: cantidadPedida,
            alistadas: cantidadAlistada,
            exceso: sobrecumplimiento
          });
          hayProblemas = true;
        }

        if (hayDiscrepancia) {
          const faltante = cantidadEnviada - cantidadRecibida;
          console.log(`   ⚠️  DISCREPANCIA: Falta recibir ${faltante} unidades`);
          console.log(`   💬 Observación: ${producto.observacionesRecepcion || 'N/A'}`);
          problemas.discrepancias.push({
            producto: producto.descripcion,
            talla: producto.talla,
            enviadas: cantidadEnviada,
            recibidas: cantidadRecibida,
            faltante: faltante,
            observacion: producto.observacionesRecepcion
          });
          hayProblemas = true;
        }

        if (pendiente > 0 && cantidadAlistada === 0) {
          problemas.sinAlistar.push({
            producto: producto.descripcion,
            talla: producto.talla,
            pendiente: pendiente
          });
        }

        console.log('');
      });

      // Resumen de problemas
      if (hayProblemas) {
        console.log('='.repeat(70));
        console.log('⚠️  RESUMEN DE PROBLEMAS DETECTADOS');
        console.log('='.repeat(70));
        console.log('');

        if (problemas.sobrecumplimiento.length > 0) {
          console.log('🔴 SOBRECUMPLIMIENTOS:');
          console.log('-'.repeat(70));
          let totalExceso = 0;
          problemas.sobrecumplimiento.forEach(p => {
            console.log(`• ${p.producto} (Talla ${p.talla})`);
            console.log(`  Pedidas: ${p.pedidas} | Alistadas: ${p.alistadas} | Exceso: ${p.exceso}`);
            totalExceso += p.exceso;
          });
          console.log('');
          console.log(`📊 Total de unidades en exceso: ${totalExceso}`);
          console.log('');
          console.log('💡 RECOMENDACIÓN:');
          console.log('   Necesitas descontar estas unidades del inventario para corregir el stock.');
          console.log('   Puedes hacerlo manualmente desde "Gestión de Costos" o');
          console.log('   crear una salida de inventario por el total en exceso.');
          console.log('');
        }

        if (problemas.discrepancias.length > 0) {
          console.log('🟡 DISCREPANCIAS EN RECEPCIÓN:');
          console.log('-'.repeat(70));
          let totalFaltante = 0;
          problemas.discrepancias.forEach(p => {
            console.log(`• ${p.producto} (Talla ${p.talla})`);
            console.log(`  Enviadas: ${p.enviadas} | Recibidas: ${p.recibidas} | Faltante: ${p.faltante}`);
            if (p.observacion) {
              console.log(`  Observación: ${p.observacion}`);
            }
            totalFaltante += p.faltante;
          });
          console.log('');
          console.log(`📊 Total de unidades faltantes: ${totalFaltante}`);
          console.log('');
          console.log('💡 RECOMENDACIÓN:');
          console.log('   Estas discrepancias ya están registradas en el sistema.');
          console.log('   El sistema automáticamente creará pendientes para renviar estos productos.');
          console.log('');
        }
      } else {
        console.log('✅ No se detectaron problemas en este pedido');
        console.log('');
      }

      // Mostrar productos sin alistar
      if (problemas.sinAlistar.length > 0) {
        console.log('📋 PRODUCTOS SIN ALISTAR:');
        console.log('-'.repeat(70));
        problemas.sinAlistar.forEach(p => {
          console.log(`• ${p.producto} (Talla ${p.talla}) - Pendiente: ${p.pendiente}`);
        });
        console.log('');
      }
    }

    console.log('='.repeat(70));
    console.log('✅ DIAGNÓSTICO COMPLETADO');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error(error.stack);
  }
})();
