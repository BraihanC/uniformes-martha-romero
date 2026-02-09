import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function buscarAbono405() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  BUSCANDO ABONO ORIGINAL DE PEDIDO #405');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. Buscar el pedido #405 en la colección de pedidos
    console.log('🔍 Buscando Pedido #405 en colección pedidos...\n');

    const pedidosSnap = await db.collection('pedidos').get();
    let pedido405 = null;

    pedidosSnap.docs.forEach(doc => {
      const d = doc.data();
      if (d.numeroPedido === 405 || d.numeroPedido === '405' || d.numeroPedido === '0405') {
        pedido405 = { id: doc.id, ...d };
      }
    });

    if (!pedido405) {
      console.log('  ❌ No se encontró Pedido #405 en colección pedidos\n');
    } else {
      console.log(`  ✅ Pedido #405 encontrado: ID=${pedido405.id}`);
      console.log(`     Cliente: ${pedido405.clienteNombre || 'N/A'}`);
      console.log(`     Total: $${(pedido405.total || 0).toLocaleString('es-CO')}`);
      console.log(`     Estado: ${pedido405.estado || 'N/A'}`);
      const fechaCreacion = pedido405.createdAt?.toDate ? pedido405.createdAt.toDate() : null;
      console.log(`     Creado: ${fechaCreacion ? fechaCreacion.toLocaleString('es-CO') : 'N/A'}`);
      console.log('');

      // 2. Buscar todas las transacciones con pedidoId del #405
      console.log('🔍 Buscando transacciones con pedidoId del #405...\n');

      const transSnap = await db.collection('transactions')
        .where('pedidoId', '==', pedido405.id)
        .get();

      console.log(`  Transacciones encontradas: ${transSnap.size}\n`);

      transSnap.docs.forEach((doc, i) => {
        const d = doc.data();
        const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
        console.log(`  ${i + 1}. ID: ${doc.id}`);
        console.log(`     Tipo: ${d.tipo}`);
        console.log(`     Monto: $${(d.monto || 0).toLocaleString('es-CO')}`);
        console.log(`     Método: ${d.metodoPago}`);
        console.log(`     Descripción: ${d.descripcion || d.concepto || 'N/A'}`);
        console.log(`     Anulada: ${d.anulada || false}`);
        console.log(`     Fecha: ${fecha.toLocaleString('es-CO')}`);
        if (d.fechaAnulacion) {
          const fechaAnul = d.fechaAnulacion?.toDate ? d.fechaAnulacion.toDate() : new Date(d.fechaAnulacion);
          console.log(`     Fecha anulación: ${fechaAnul.toLocaleString('es-CO')}`);
        }
        if (d.motivoAnulacion) {
          console.log(`     Motivo anulación: ${d.motivoAnulacion}`);
        }
        console.log('');
      });
    }

    // 3. Buscar Pedido #407
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  BUSCANDO PEDIDO #407');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let pedido407 = null;
    pedidosSnap.docs.forEach(doc => {
      const d = doc.data();
      if (d.numeroPedido === 407 || d.numeroPedido === '407' || d.numeroPedido === '0407') {
        pedido407 = { id: doc.id, ...d };
      }
    });

    if (!pedido407) {
      console.log('  ❌ No se encontró Pedido #407 en colección pedidos\n');
    } else {
      console.log(`  ✅ Pedido #407 encontrado: ID=${pedido407.id}`);
      console.log(`     Cliente: ${pedido407.clienteNombre || 'N/A'}`);
      console.log(`     Total: $${(pedido407.total || 0).toLocaleString('es-CO')}`);
      console.log(`     Estado: ${pedido407.estado || 'N/A'}`);
      const fechaCreacion = pedido407.createdAt?.toDate ? pedido407.createdAt.toDate() : null;
      console.log(`     Creado: ${fechaCreacion ? fechaCreacion.toLocaleString('es-CO') : 'N/A'}`);
      console.log('');

      const trans407Snap = await db.collection('transactions')
        .where('pedidoId', '==', pedido407.id)
        .get();

      console.log(`  Transacciones de Pedido #407: ${trans407Snap.size}\n`);

      trans407Snap.docs.forEach((doc, i) => {
        const d = doc.data();
        const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
        console.log(`  ${i + 1}. ID: ${doc.id}`);
        console.log(`     Tipo: ${d.tipo}`);
        console.log(`     Monto: $${(d.monto || 0).toLocaleString('es-CO')}`);
        console.log(`     Método: ${d.metodoPago}`);
        console.log(`     Descripción: ${d.descripcion || d.concepto || 'N/A'}`);
        console.log(`     Anulada: ${d.anulada || false}`);
        console.log(`     Fecha: ${fecha.toLocaleString('es-CO')}`);
        console.log('');
      });
    }

    // 4. Buscar la devolución de la factura original relacionada con SALGADO SONIA
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  DEVOLUCIONES DE SALGADO SONIA (TODAS LAS FECHAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const devSoniaSnap = await db.collection('transactions')
      .where('clienteNombre', '==', 'SALGADO SONIA')
      .get();

    if (devSoniaSnap.empty) {
      console.log('  No se encontraron transacciones para SALGADO SONIA\n');

      // Intentar buscar de forma flexible
      const allTransSnap = await db.collection('transactions')
        .where('tipo', '==', 'devolucion')
        .get();

      console.log(`  Buscando en ${allTransSnap.size} devoluciones totales...\n`);
      allTransSnap.docs.forEach((doc, i) => {
        const d = doc.data();
        const nombre = (d.clienteNombre || '').toUpperCase();
        if (nombre.includes('SALGADO') || nombre.includes('SONIA')) {
          const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
          console.log(`  ENCONTRADA: ID: ${doc.id}`);
          console.log(`     Monto: $${(d.monto || 0).toLocaleString('es-CO')}`);
          console.log(`     Método: ${d.metodoPago}`);
          console.log(`     Cliente: ${d.clienteNombre}`);
          console.log(`     Descripción: ${d.descripcion || d.concepto || 'N/A'}`);
          console.log(`     Anulada: ${d.anulada || false}`);
          console.log(`     Fecha: ${fecha.toLocaleString('es-CO')}`);
          console.log('');
        }
      });
    } else {
      devSoniaSnap.docs.forEach((doc, i) => {
        const d = doc.data();
        const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
        console.log(`  ${i + 1}. ID: ${doc.id}`);
        console.log(`     Tipo: ${d.tipo}`);
        console.log(`     Monto: $${(d.monto || 0).toLocaleString('es-CO')}`);
        console.log(`     Método: ${d.metodoPago}`);
        console.log(`     Descripción: ${d.descripcion || d.concepto || 'N/A'}`);
        console.log(`     Anulada: ${d.anulada || false}`);
        console.log(`     Fecha: ${fecha.toLocaleString('es-CO')}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

buscarAbono405();
