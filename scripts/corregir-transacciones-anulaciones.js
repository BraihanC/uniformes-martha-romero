import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function corregirTransaccionesAnulaciones() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  CORRECCIÓN: Pedido #405 - Cambio de talla');
    console.log('  (El dinero nunca salió de caja, se anula transacción)');
    console.log('═══════════════════════════════════════════════════════\n');

    // Transacción específica del Pedido #405 (identificada en diagnóstico)
    const transId = 'l43ZFAcfjOg0FvEGk0YB';

    const transRef = db.collection('transactions').doc(transId);
    const transDoc = await transRef.get();

    if (!transDoc.exists) {
      console.log(`❌ No se encontró la transacción ${transId}`);
      return;
    }

    const data = transDoc.data();
    const fecha = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);

    console.log('📄 Transacción encontrada:');
    console.log(`   ID: ${transId}`);
    console.log(`   Tipo: ${data.tipo}`);
    console.log(`   Monto: $${(data.monto || 0).toLocaleString('es-CO')}`);
    console.log(`   Método: ${data.metodoPago}`);
    console.log(`   Descripción: ${data.descripcion || data.concepto || 'N/A'}`);
    console.log(`   Pedido: #${data.numeroPedido || 'N/A'}`);
    console.log(`   Fecha: ${fecha.toLocaleString('es-CO')}`);
    console.log(`   Anulada: ${data.anulada || false}\n`);

    if (data.anulada === true) {
      console.log('⚠️  Esta transacción ya está marcada como anulada. No se requiere corrección.\n');
      return;
    }

    // Aplicar corrección: marcar como anulada
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  APLICANDO CORRECCIÓN...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await transRef.update({
      anulada: true,
      fechaAnulacion: admin.firestore.FieldValue.serverTimestamp(),
      motivoAnulacion: 'Corrección: fue un cambio de talla, el dinero no salió de caja. La devolución de la factura original se usó como abono del nuevo pedido.',
      _corregido: true,
      _fechaCorreccion: admin.firestore.FieldValue.serverTimestamp(),
      _motivoCorreccion: 'Bug: anulación de pedido creó transacción con monto positivo y método Devolución. En este caso el dinero nunca salió de caja (cambio de talla).'
    });

    console.log('  ✅ Transacción marcada como anulada');
    console.log('');
    console.log('  Cambios aplicados:');
    console.log('     anulada: false → true');
    console.log('     motivoAnulacion: "Corrección: cambio de talla, dinero no salió de caja"');
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ CORRECCIÓN COMPLETADA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('  Impacto en el reporte de hoy:');
    console.log('     Efectivo Esperado antes:  -$33.850');
    console.log('     Corrección:               +$89.000 (se excluye la transacción)');
    console.log('     Efectivo Esperado ahora:  ~$55.150\n');

    console.log('  🔄 Recarga el reporte de Cierre de Caja para verificar.\n');

  } catch (error) {
    console.error('❌ Error al corregir:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

corregirTransaccionesAnulaciones();
