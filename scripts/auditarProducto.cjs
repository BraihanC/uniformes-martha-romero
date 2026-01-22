/**
 * Script de Auditoría: Investigar un producto específico
 *
 * Busca todas las entradas y salidas de un producto para verificar el stock
 *
 * Ejecutar con: node scripts/auditarProducto.cjs MA019T8
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin (solo si no está inicializado)
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function auditarProducto(referenciaBuscar) {
  console.log('========================================');
  console.log(`AUDITORÍA DE PRODUCTO: ${referenciaBuscar}`);
  console.log('========================================\n');

  try {
    // 1. Buscar el producto por referencia
    console.log('Buscando producto...');
    const productsSnapshot = await db.collection('products')
      .where('referencia', '==', referenciaBuscar)
      .get();

    if (productsSnapshot.empty) {
      console.log(`No se encontró producto con referencia: ${referenciaBuscar}`);
      return;
    }

    const producto = { id: productsSnapshot.docs[0].id, ...productsSnapshot.docs[0].data() };
    console.log('\n--- DATOS DEL PRODUCTO ---');
    console.log(`ID: ${producto.id}`);
    console.log(`Nombre: ${producto.nombre}`);
    console.log(`Referencia: ${producto.referencia}`);
    console.log(`Talla: ${producto.talla}`);
    console.log(`stockTotal: ${producto.stockTotal || 0}`);
    console.log(`stockReservadoPedidos: ${producto.stockReservadoPedidos || 0}`);
    console.log(`stockReservadoApartados: ${producto.stockReservadoApartados || 0}`);
    console.log(`totalPrendasPedidas: ${producto.totalPrendasPedidas || 0}`);

    const stockDisponible = (producto.stockTotal || 0) - (producto.stockReservadoPedidos || 0) - (producto.stockReservadoApartados || 0);
    console.log(`Stock Disponible calculado: ${stockDisponible}`);

    // 2. Buscar todas las entradas de stock (stockEntries)
    // NOTA: EntradaSatelite usa "productId", EntradaProveedor puede usar otro nombre
    console.log('\n--- ENTRADAS DE STOCK (stockEntries) ---');
    // Buscar con ambos campos posibles
    const stockEntriesSnapshot1 = await db.collection('stockEntries')
      .where('productId', '==', producto.id)
      .get();
    const stockEntriesSnapshot2 = await db.collection('stockEntries')
      .where('productoId', '==', producto.id)
      .get();

    // Combinar resultados (evitar duplicados por ID)
    const entriesMap = new Map();
    stockEntriesSnapshot1.docs.forEach(doc => entriesMap.set(doc.id, { id: doc.id, ...doc.data() }));
    stockEntriesSnapshot2.docs.forEach(doc => entriesMap.set(doc.id, { id: doc.id, ...doc.data() }));
    const stockEntriesDocs = Array.from(entriesMap.values());

    let totalEntradas = 0;
    if (stockEntriesDocs.length === 0) {
      console.log('No se encontraron entradas de stock para este producto.');
    } else {
      for (const entry of stockEntriesDocs) {
        const fecha = entry.createdAt?.toDate?.() || entry.fechaEntrada?.toDate?.() || 'Sin fecha';
        const cantidad = entry.cantidad || 0;
        totalEntradas += cantidad;
        const fechaStr = fecha instanceof Date ? fecha.toLocaleDateString('es-CO') : fecha;
        console.log(`  ${fechaStr} | +${cantidad} | ${entry.tipoEntrada || 'N/A'} | ${entry.sateliteNombre || entry.proveedorNombre || 'N/A'}`);
      }
    }
    console.log(`  TOTAL ENTRADAS: +${totalEntradas}`);

    // 3. Buscar todas las ventas (sales) que incluyan este producto
    console.log('\n--- VENTAS (sales) ---');
    // Las ventas tienen items con productoId
    const salesSnapshot = await db.collection('sales').get();

    let totalVentas = 0;
    const ventasDelProducto = [];

    for (const doc of salesSnapshot.docs) {
      const sale = doc.data();
      if (sale.items && Array.isArray(sale.items)) {
        for (const item of sale.items) {
          if (item.productoId === producto.id || item.id === producto.id) {
            const cantidad = item.cantidad || 1;
            totalVentas += cantidad;
            ventasDelProducto.push({
              fecha: sale.createdAt?.toDate?.() || 'Sin fecha',
              cantidad,
              numeroFactura: sale.numeroFactura || 'N/A',
              tipo: sale.tipo || 'venta'
            });
          }
        }
      }
    }

    if (ventasDelProducto.length === 0) {
      console.log('No se encontraron ventas de este producto.');
    } else {
      for (const venta of ventasDelProducto) {
        const fechaStr = venta.fecha instanceof Date ? venta.fecha.toLocaleDateString('es-CO') : venta.fecha;
        console.log(`  ${fechaStr} | -${venta.cantidad} | Factura: ${venta.numeroFactura} | ${venta.tipo}`);
      }
    }
    console.log(`  TOTAL VENTAS: -${totalVentas}`);

    // 4. Buscar apartados que incluyan este producto
    console.log('\n--- APARTADOS ---');
    const apartadosSnapshot = await db.collection('apartados').get();

    let totalApartados = 0;
    let totalApartadosEntregados = 0;
    const apartadosDelProducto = [];

    for (const doc of apartadosSnapshot.docs) {
      const apartado = doc.data();
      if (apartado.items && Array.isArray(apartado.items)) {
        for (const item of apartado.items) {
          if (item.productoId === producto.id || item.id === producto.id) {
            const cantidad = item.cantidad || 1;
            const entregado = apartado.estadoGeneral === 'Entregado';
            if (entregado) {
              totalApartadosEntregados += cantidad;
            } else {
              totalApartados += cantidad;
            }
            apartadosDelProducto.push({
              fecha: apartado.createdAt?.toDate?.() || 'Sin fecha',
              cantidad,
              numeroApartado: apartado.numeroApartado || 'N/A',
              estado: apartado.estadoGeneral || 'Pendiente'
            });
          }
        }
      }
    }

    if (apartadosDelProducto.length === 0) {
      console.log('No se encontraron apartados de este producto.');
    } else {
      for (const ap of apartadosDelProducto) {
        const fechaStr = ap.fecha instanceof Date ? ap.fecha.toLocaleDateString('es-CO') : ap.fecha;
        console.log(`  ${fechaStr} | ${ap.cantidad} | Apartado: ${ap.numeroApartado} | ${ap.estado}`);
      }
    }
    console.log(`  TOTAL APARTADOS ACTIVOS (reservados): ${totalApartados}`);
    console.log(`  TOTAL APARTADOS ENTREGADOS: ${totalApartadosEntregados}`);

    // 5. Buscar en pedidos
    console.log('\n--- PEDIDOS ---');
    const pedidosSnapshot = await db.collection('pedidos').get();

    let totalPedidosActivos = 0;
    let totalPedidosEntregados = 0;
    let totalPedidosListos = 0;
    const pedidosDelProducto = [];

    for (const doc of pedidosSnapshot.docs) {
      const pedido = doc.data();
      if (pedido.items && Array.isArray(pedido.items)) {
        for (const item of pedido.items) {
          if (item.productoId === producto.id) {
            const cantidad = item.cantidad || 1;
            const cantidadEntregada = item.cantidadEntregada || 0;
            const cantidadLista = item.cantidadLista || 0;
            const estado = item.estadoItem || 'En Producción';
            const anulado = item.anulado || false;

            if (!anulado) {
              if (estado === 'Entregado') {
                totalPedidosEntregados += cantidad;
              } else if (estado === 'Listo para Entrega') {
                totalPedidosListos += (cantidad - cantidadEntregada);
              } else {
                totalPedidosActivos += (cantidad - cantidadEntregada);
              }
            }

            pedidosDelProducto.push({
              fecha: pedido.createdAt?.toDate?.() || 'Sin fecha',
              cantidad,
              cantidadEntregada,
              cantidadLista,
              numeroPedido: pedido.numeroPedido || 'N/A',
              estado,
              anulado
            });
          }
        }
      }
    }

    if (pedidosDelProducto.length === 0) {
      console.log('No se encontraron pedidos de este producto.');
    } else {
      for (const ped of pedidosDelProducto) {
        const fechaStr = ped.fecha instanceof Date ? ped.fecha.toLocaleDateString('es-CO') : ped.fecha;
        const anuladoStr = ped.anulado ? ' [ANULADO]' : '';
        console.log(`  ${fechaStr} | ${ped.cantidad} (entregados: ${ped.cantidadEntregada}) | Pedido: ${ped.numeroPedido} | ${ped.estado}${anuladoStr}`);
      }
    }
    console.log(`  TOTAL PEDIDOS ACTIVOS (en producción): ${totalPedidosActivos}`);
    console.log(`  TOTAL PEDIDOS LISTOS (reservados): ${totalPedidosListos}`);
    console.log(`  TOTAL PEDIDOS ENTREGADOS: ${totalPedidosEntregados}`);

    // 6. Calcular stock esperado
    console.log('\n========================================');
    console.log('CÁLCULO DE STOCK ESPERADO');
    console.log('========================================');

    const stockEsperado = totalEntradas - totalVentas - totalApartadosEntregados - totalPedidosEntregados;
    const reservadoEsperadoPedidos = totalPedidosListos;
    const reservadoEsperadoApartados = totalApartados;
    const disponibleEsperado = stockEsperado - reservadoEsperadoPedidos - reservadoEsperadoApartados;

    console.log(`\nEntradas totales:           +${totalEntradas}`);
    console.log(`Ventas totales:             -${totalVentas}`);
    console.log(`Apartados entregados:       -${totalApartadosEntregados}`);
    console.log(`Pedidos entregados:         -${totalPedidosEntregados}`);
    console.log(`----------------------------------------`);
    console.log(`Stock Total ESPERADO:        ${stockEsperado}`);
    console.log(`Stock Total ACTUAL:          ${producto.stockTotal || 0}`);
    console.log(`DIFERENCIA:                  ${(producto.stockTotal || 0) - stockEsperado}`);

    console.log(`\nReservado Pedidos ESPERADO:  ${reservadoEsperadoPedidos}`);
    console.log(`Reservado Pedidos ACTUAL:    ${producto.stockReservadoPedidos || 0}`);
    console.log(`DIFERENCIA:                  ${(producto.stockReservadoPedidos || 0) - reservadoEsperadoPedidos}`);

    console.log(`\nReservado Apartados ESPERADO: ${reservadoEsperadoApartados}`);
    console.log(`Reservado Apartados ACTUAL:   ${producto.stockReservadoApartados || 0}`);
    console.log(`DIFERENCIA:                   ${(producto.stockReservadoApartados || 0) - reservadoEsperadoApartados}`);

    console.log(`\nStock Disponible ESPERADO:   ${disponibleEsperado}`);
    console.log(`Stock Disponible ACTUAL:     ${stockDisponible}`);
    console.log(`DIFERENCIA:                  ${stockDisponible - disponibleEsperado}`);

    if ((producto.stockTotal || 0) !== stockEsperado) {
      console.log('\n⚠️  HAY DISCREPANCIA EN EL STOCK TOTAL');
    }

    console.log('\n========================================');
    console.log('AUDITORÍA COMPLETADA');
    console.log('========================================');

  } catch (error) {
    console.error('Error durante la auditoría:', error);
    throw error;
  }
}

// Obtener referencia del argumento de línea de comandos
const referencia = process.argv[2];
if (!referencia) {
  console.log('Uso: node scripts/auditarProducto.cjs <REFERENCIA>');
  console.log('Ejemplo: node scripts/auditarProducto.cjs MA019T8');
  process.exit(1);
}

auditarProducto(referencia)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
