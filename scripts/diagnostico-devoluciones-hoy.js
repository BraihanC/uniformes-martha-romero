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

async function diagnosticarDevolucionesHoy() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  DIAGNÓSTICO DETALLADO: Transacciones 6/02/2026');
    console.log('═══════════════════════════════════════════════════════\n');

    // Rango del 6/02/2026
    const inicio = new Date(2026, 1, 6, 0, 0, 0);
    const fin = new Date(2026, 1, 6, 23, 59, 59);
    const startTs = admin.firestore.Timestamp.fromDate(inicio);
    const endTs = admin.firestore.Timestamp.fromDate(fin);

    // Consultar TODAS las transacciones del 6/02 (sin filtro por tipo)
    const allSnap = await db.collection('transactions')
      .where('fecha', '>=', startTs)
      .where('fecha', '<=', endTs)
      .get();

    const todas = allSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      _fecha: doc.data().fecha?.toDate ? doc.data().fecha.toDate() : new Date(doc.data().fecha)
    }));

    // ═══════════════════════════════════════════════════════
    // 1. DEVOLUCIONES del 6/02
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  1. DEVOLUCIONES DEL 6/02');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const devoluciones = todas.filter(t => t.tipo === 'devolucion');
    devoluciones.forEach((d, i) => {
      console.log(`  ${i + 1}. ID: ${d.id}`);
      console.log(`     Monto: $${(d.monto || 0).toLocaleString('es-CO')}`);
      console.log(`     Método: ${d.metodoPago}`);
      console.log(`     Descripción: ${d.descripcion || d.concepto || 'N/A'}`);
      console.log(`     Cliente: ${d.clienteNombre || 'N/A'}`);
      console.log(`     VentaId: ${d.ventaId || 'N/A'}`);
      console.log(`     Anulada: ${d.anulada || false}`);
      console.log(`     Hora: ${d._fecha.toLocaleString('es-CO')}`);
      console.log('');
    });
    console.log(`  Total devoluciones: ${devoluciones.length}, Suma: $${devoluciones.reduce((s, d) => s + (d.monto || 0), 0).toLocaleString('es-CO')}\n`);

    // ═══════════════════════════════════════════════════════
    // 2. Transacciones de Pedido #405
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  2. TRANSACCIONES DE PEDIDO #405 (TODAS LAS FECHAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Buscar por numeroPedido (puede ser number o string)
    const p405a = await db.collection('transactions').where('numeroPedido', '==', 405).get();
    const p405b = await db.collection('transactions').where('numeroPedido', '==', '405').get();
    const p405c = await db.collection('transactions').where('numeroPedido', '==', '0405').get();

    const p405Docs = [...p405a.docs, ...p405b.docs, ...p405c.docs];
    const p405Ids = new Set();

    p405Docs.forEach((doc, i) => {
      if (p405Ids.has(doc.id)) return;
      p405Ids.add(doc.id);
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

    if (p405Ids.size === 0) {
      // Buscar por pedidoId en el pedido mismo
      console.log('  Buscando pedido #405 en colección pedidos...\n');
      const pedidosSnap = await db.collection('pedidos')
        .where('numeroPedido', '==', 405)
        .get();

      if (!pedidosSnap.empty) {
        const pedidoId = pedidosSnap.docs[0].id;
        console.log(`  PedidoId: ${pedidoId}`);
        const transByPedido = await db.collection('transactions')
          .where('pedidoId', '==', pedidoId)
          .get();

        transByPedido.docs.forEach((doc, i) => {
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
    }

    // ═══════════════════════════════════════════════════════
    // 3. Transacciones de Pedido #407
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  3. TRANSACCIONES DE PEDIDO #407 (TODAS LAS FECHAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const p407a = await db.collection('transactions').where('numeroPedido', '==', 407).get();
    const p407b = await db.collection('transactions').where('numeroPedido', '==', '407').get();
    const p407c = await db.collection('transactions').where('numeroPedido', '==', '0407').get();

    const p407Docs = [...p407a.docs, ...p407b.docs, ...p407c.docs];
    const p407Ids = new Set();

    p407Docs.forEach((doc, i) => {
      if (p407Ids.has(doc.id)) return;
      p407Ids.add(doc.id);
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

    if (p407Ids.size === 0) {
      console.log('  No se encontraron transacciones para Pedido #407\n');
    }

    // ═══════════════════════════════════════════════════════
    // 4. RECÁLCULO completo del 6/02 (post-corrección)
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  4. RECÁLCULO DEL 6/02 (post-corrección)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let totalIngEfectivo = 0;
    let totalEgrEfectivo = 0;
    let totalRetiros = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    let activas = 0;

    todas.forEach(d => {
      const excluida = d.anulada === true || d.metodoPago === 'Pendiente' || (d.tipo === 'entrada_satelite' && d.afectaCaja !== true);
      if (excluida) return;

      activas++;
      const monto = d.monto || 0;
      const metodo = d.metodoPago || 'Indefinido';

      if (d.tipo === 'retiro_caja') {
        totalRetiros += Math.abs(monto);
      } else if (monto > 0) {
        totalIngresos += monto;
        if (metodo === 'Efectivo') totalIngEfectivo += monto;
      } else {
        totalEgresos += monto;
        if (metodo === 'Efectivo') totalEgrEfectivo += monto;
      }
    });

    // Base de caja
    const allBases = await db.collection('bases_caja').get();
    let base = 0;
    console.log('  Bases de caja en el sistema:');
    allBases.docs.forEach(doc => {
      const d = doc.data();
      console.log(`     ${doc.id}: fecha=${d.fecha}, monto=$${(d.monto || 0).toLocaleString('es-CO')}`);
      if (d.fecha === '2026-02-06' || d.fecha === '06/02/2026') {
        base = d.monto || 0;
      }
    });

    const saldoNetoEfectivo = totalIngEfectivo + totalEgrEfectivo;
    const efectivoEsperado = base + saldoNetoEfectivo - totalRetiros;

    console.log('');
    console.log(`  Transacciones activas: ${activas}`);
    console.log(`  Total Ingresos: $${totalIngresos.toLocaleString('es-CO')}`);
    console.log(`  Total Egresos: $${totalEgresos.toLocaleString('es-CO')}`);
    console.log(`  Ingresos Efectivo: $${totalIngEfectivo.toLocaleString('es-CO')}`);
    console.log(`  Egresos Efectivo: $${totalEgrEfectivo.toLocaleString('es-CO')}`);
    console.log(`  Saldo Neto Efectivo: $${saldoNetoEfectivo.toLocaleString('es-CO')}`);
    console.log(`  Retiros: $${totalRetiros.toLocaleString('es-CO')}`);
    console.log(`  Base: $${base.toLocaleString('es-CO')}`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  EFECTIVO ESPERADO: $${efectivoEsperado.toLocaleString('es-CO')}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

diagnosticarDevolucionesHoy();
