// ========================================
// SCRIPT DE INVESTIGACIÓN - DESCUADRE DE INVENTARIO
// CAMISETA MA DEP TALLA 16
// ========================================

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
} catch (error) {
  console.error('ERROR: No se encontró serviceAccountKey.json');
  console.error('Por favor, descarga la clave de servicio desde Firebase Console');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Configuración del producto
// REFERENCIA EXACTA del producto (no solo el prefijo)
const REFERENCIA = 'MA011T16'; // CAMISETA MA DEP TALLA 16
const TALLA = '16';

console.log('INVESTIGACIÓN DE DESCUADRE DE INVENTARIO');
console.log('============================================');
console.log('Producto: CAMISETA MA DEP TALLA ' + TALLA);
console.log('Referencia: ' + REFERENCIA);
console.log('Talla: ' + TALLA);
console.log('============================================\n');

async function investigarDescuadre() {
  try {
    console.log('Buscando pedidos que contengan este producto...\n');
    
    const pedidosSnapshot = await db.collection('pedidos').get();
    
    let pedidosEncontrados = 0;
    let totalReservadoCalculado = 0;
    const detallesPedidos = [];
    
    for (const pedidoDoc of pedidosSnapshot.docs) {
      const pedido = pedidoDoc.data();
      const pedidoId = pedidoDoc.id;
      
      if (pedido.items && Array.isArray(pedido.items)) {
        for (const item of pedido.items) {
          const coincideReferencia = item.referencia === REFERENCIA || 
                                     (item.referencia && item.referencia.startsWith(REFERENCIA));
          const coincideTalla = item.talla === TALLA;
          
          if (coincideReferencia && coincideTalla) {
            pedidosEncontrados++;
            
            let reservaEsperada = 0;
            const estadoItem = item.estadoItem || 'En Producción';
            const cantidad = item.cantidad || 0;
            const cantidadLista = item.cantidadLista || 0;
            const cantidadEntregada = item.cantidadEntregada || 0;
            const anulado = item.anulado || false;
            
            if (!anulado) {
              switch (estadoItem) {
                case 'En Producción':
                  reservaEsperada = 0;
                  break;
                case 'Parcialmente Listo':
                  reservaEsperada = cantidadLista;
                  break;
                case 'Listo para Entrega':
                  reservaEsperada = cantidad;
                  break;
                case 'Entregado':
                  reservaEsperada = 0;
                  break;
                default:
                  reservaEsperada = 0;
              }
            }
            
            totalReservadoCalculado += reservaEsperada;
            
            const detalle = {
              numeroPedido: pedido.numeroPedido || pedidoId,
              pedidoId: pedidoId,
              cliente: pedido.cliente?.nombre || 'Sin nombre',
              telefono: pedido.cliente?.telefono || 'N/A',
              estadoPedido: pedido.estado || 'N/A',
              nombreItem: item.nombre || 'Sin nombre',
              referencia: item.referencia || 'N/A',
              talla: item.talla || 'N/A',
              estadoItem: estadoItem,
              cantidad: cantidad,
              cantidadLista: cantidadLista,
              cantidadEntregada: cantidadEntregada,
              anulado: anulado,
              reservaEsperada: reservaEsperada,
              fechaCreacion: pedido.fechaCreacion?.toDate?.() || pedido.fechaCreacion || 'N/A',
              fechaActualizacion: pedido.fechaActualizacion?.toDate?.() || pedido.fechaActualizacion || 'N/A'
            };
            
            detallesPedidos.push(detalle);
            
            console.log('\n============================================================');
            console.log('PEDIDO #' + detalle.numeroPedido);
            console.log('============================================================');
            console.log('ID Firestore: ' + detalle.pedidoId);
            console.log('Cliente: ' + detalle.cliente);
            console.log('Teléfono: ' + detalle.telefono);
            console.log('Estado del Pedido: ' + detalle.estadoPedido);
            console.log('Fecha Creación: ' + detalle.fechaCreacion);
            console.log('\n--- DETALLE DEL ITEM ---');
            console.log('Producto: ' + detalle.nombreItem);
            console.log('Referencia: ' + detalle.referencia);
            console.log('Talla: ' + detalle.talla);
            console.log('Estado Item: ' + detalle.estadoItem);
            console.log('Cantidad Total: ' + detalle.cantidad);
            console.log('Cantidad Lista: ' + detalle.cantidadLista);
            console.log('Cantidad Entregada: ' + detalle.cantidadEntregada);
            console.log('Anulado: ' + (detalle.anulado ? 'SÍ' : 'NO'));
            console.log('\nReserva Esperada: ' + reservaEsperada + ' unidades');
            
            console.log('\nExplicación:');
            if (anulado) {
              console.log('   - Item ANULADO -> No reserva inventario (0)');
            } else {
              switch (estadoItem) {
                case 'En Producción':
                  console.log('   - Estado "En Producción" -> No reserva hasta que esté listo (0)');
                  break;
                case 'Parcialmente Listo':
                  console.log('   - Estado "Parcialmente Listo" -> Reserva ' + cantidadLista + ' (cantidadLista)');
                  break;
                case 'Listo para Entrega':
                  console.log('   - Estado "Listo para Entrega" -> Reserva ' + cantidad + ' (cantidad total)');
                  break;
                case 'Entregado':
                  console.log('   - Estado "Entregado" -> Ya se entregó, no reserva (0)');
                  break;
              }
            }
          }
        }
      }
    }
    
    console.log('\n\n============================================================');
    console.log('RESUMEN DEL ANÁLISIS');
    console.log('============================================================');
    console.log('Total de pedidos encontrados: ' + pedidosEncontrados);
    console.log('Total stockReservadoPedidos calculado: ' + totalReservadoCalculado + ' unidades');
    console.log('\nInvestigación completada');
    
    console.log('\n\n============================================================');
    console.log('VERIFICANDO PRODUCTO EN INVENTARIO');
    console.log('============================================================');
    
    const productosSnapshot = await db.collection('productos')
      .where('referencia', '==', REFERENCIA)
      .where('talla', '==', TALLA)
      .get();
    
    if (productosSnapshot.empty) {
      console.log('No se encontró el producto en inventario');
    } else {
      productosSnapshot.forEach(doc => {
        const producto = doc.data();
        console.log('\nID Producto: ' + doc.id);
        console.log('Nombre: ' + (producto.nombre || 'N/A'));
        console.log('Referencia: ' + producto.referencia);
        console.log('Talla: ' + producto.talla);
        console.log('Stock Total: ' + (producto.stockTotal || 0));
        console.log('Stock Disponible: ' + (producto.stockDisponible || 0));
        console.log('Stock Reservado Pedidos (actual): ' + (producto.stockReservadoPedidos || 0));
        console.log('Stock Reservado Apartados: ' + (producto.stockReservadoApartados || 0));
        console.log('\nCOMPARACIÓN:');
        console.log('   Stock Reservado ACTUAL: ' + (producto.stockReservadoPedidos || 0));
        console.log('   Stock Reservado CALCULADO: ' + totalReservadoCalculado);
        console.log('   Diferencia: ' + ((producto.stockReservadoPedidos || 0) - totalReservadoCalculado));
        
        if ((producto.stockReservadoPedidos || 0) !== totalReservadoCalculado) {
          console.log('\nDESCUADRE DETECTADO!');
          console.log('   El stockReservadoPedidos NO coincide con los pedidos actuales.');
        } else {
          console.log('\nCUADRADO!');
          console.log('   El stockReservadoPedidos coincide con los pedidos actuales.');
        }
      });
    }
    
    console.log('\n============================================================\n');
    
  } catch (error) {
    console.error('Error durante la investigación:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

investigarDescuadre()
  .then(() => {
    console.log('Script finalizado correctamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
