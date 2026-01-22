/**
 * Script para recalcular totales de un pedido
 *
 * Uso: node scripts/corregirPedido.cjs <NUMERO_PEDIDO>
 * Ejemplo: node scripts/corregirPedido.cjs 174
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

async function corregirPedido(numeroPedido) {
  console.log('========================================');
  console.log(`CORREGIR PEDIDO #${numeroPedido}`);
  console.log('========================================\n');

  // Buscar pedido
  const snapshot = await db.collection('pedidos')
    .where('numeroPedido', '==', parseInt(numeroPedido))
    .get();

  if (snapshot.empty) {
    console.log(`ERROR: No se encontró pedido #${numeroPedido}`);
    return;
  }

  const doc = snapshot.docs[0];
  const pedido = doc.data();

  console.log(`Cliente: ${pedido.clienteNombre}`);
  console.log('');

  // Calcular totales correctos
  const items = pedido.items || [];
  const itemsActivos = items.filter(item => !item.anulado);
  const itemsAnulados = items.filter(item => item.anulado);

  console.log('--- PRODUCTOS ---');
  items.forEach((item, idx) => {
    const estado = item.anulado ? '[ANULADO]' : '[ACTIVO]';
    console.log(`  ${idx + 1}. ${estado} ${item.nombre} - ${item.cantidad} x $${item.precio?.toLocaleString()} = $${item.subtotal?.toLocaleString()}`);
  });
  console.log('');

  const totalCorrecto = itemsActivos.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const totalAbonado = pedido.totalAbonado || 0;
  const saldoCorrecto = Math.max(0, totalCorrecto - totalAbonado);

  console.log('VALORES ACTUALES:');
  console.log(`  totalPedido: $${(pedido.totalPedido || pedido.total || 0).toLocaleString()}`);
  console.log(`  totalAbonado: $${totalAbonado.toLocaleString()}`);
  console.log(`  saldoPendiente: $${(pedido.saldoPendiente || 0).toLocaleString()}`);
  console.log('');

  console.log('VALORES CORRECTOS:');
  console.log(`  totalPedido: $${totalCorrecto.toLocaleString()} (solo productos activos)`);
  console.log(`  totalAbonado: $${totalAbonado.toLocaleString()} (sin cambio)`);
  console.log(`  saldoPendiente: $${saldoCorrecto.toLocaleString()}`);
  console.log('');

  // Verificar si hay diferencia
  const totalActual = pedido.totalPedido || pedido.total || 0;
  const saldoActual = pedido.saldoPendiente || 0;

  if (totalActual === totalCorrecto && saldoActual === saldoCorrecto) {
    console.log('✅ El pedido ya tiene los valores correctos. No se necesita corrección.');
    return;
  }

  // Actualizar
  await db.collection('pedidos').doc(doc.id).update({
    totalPedido: totalCorrecto,
    total: totalCorrecto, // Por si usa este campo también
    saldoPendiente: saldoCorrecto,
    _correccionManual: {
      totalAnterior: totalActual,
      totalNuevo: totalCorrecto,
      saldoAnterior: saldoActual,
      saldoNuevo: saldoCorrecto,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
      motivo: 'Recálculo de totales por productos anulados'
    }
  });

  console.log('✅ Pedido corregido correctamente');

  // Verificar si hay exceso de pago
  if (totalAbonado > totalCorrecto) {
    const exceso = totalAbonado - totalCorrecto;
    console.log('');
    console.log(`⚠️  ATENCIÓN: El cliente tiene un exceso de pago de $${exceso.toLocaleString()}`);
    console.log('   Considera crear un egreso para devolverle el dinero o acreditarlo a su favor.');
  }
}

// Obtener argumentos
const numeroPedido = process.argv[2];

if (!numeroPedido) {
  console.log('Uso: node scripts/corregirPedido.cjs <NUMERO_PEDIDO>');
  console.log('Ejemplo: node scripts/corregirPedido.cjs 174');
  process.exit(1);
}

corregirPedido(numeroPedido)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
