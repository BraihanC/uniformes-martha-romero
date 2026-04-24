/**
 * Migración una sola vez: limpiar saldoPendiente en pedidos B2C anulados.
 *
 * Qué hace:
 *   - Busca todos los pedidos (colección "pedidos") con anulado == true
 *   - Si tienen saldoPendiente > 0, lo pone en 0
 *   - NO toca totalAbonado (se conserva como evidencia histórica)
 *
 * Modo dry-run por defecto: solo muestra qué cambiaría.
 * Para ejecutar de verdad, pasar el flag --apply.
 *
 * Uso:
 *   node scripts/fix-saldo-pedidos-anulados.js          (dry-run, solo muestra)
 *   node scripts/fix-saldo-pedidos-anulados.js --apply  (ejecuta los cambios)
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

async function run() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Fix: saldoPendiente en pedidos B2C anulados');
  console.log(APPLY ? '  MODO: APLICAR CAMBIOS' : '  MODO: DRY-RUN (sin cambios, usa --apply para ejecutar)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const snap = await db.collection('pedidos').where('anulado', '==', true).get();
  console.log(`Pedidos anulados encontrados: ${snap.size}`);

  const aCorregir = snap.docs.filter(d => (d.data().saldoPendiente || 0) > 0);
  console.log(`Con saldoPendiente > 0 (a corregir): ${aCorregir.length}`);
  console.log('');

  if (aCorregir.length === 0) {
    console.log('✅ No hay nada que corregir. Base limpia.');
    process.exit(0);
  }

  console.log('Pedidos que se corregirán:');
  console.log('');
  for (const d of aCorregir) {
    const data = d.data();
    console.log(`  • #${String(data.numeroPedido || '(sin número)').padStart(4, '0')} — cliente: ${data.clienteNombre || '?'} — saldo actual: $${(data.saldoPendiente || 0).toLocaleString('es-CO')}`);
  }
  console.log('');

  if (!APPLY) {
    console.log('💡 Dry-run completado. Revisa la lista de arriba.');
    console.log('   Si todo se ve bien, corre de nuevo con:');
    console.log('   node scripts/fix-saldo-pedidos-anulados.js --apply');
    process.exit(0);
  }

  console.log('Aplicando cambios...');

  // Admin SDK batch acepta hasta 500 escrituras
  const CHUNK = 400;
  let corregidos = 0;
  for (let i = 0; i < aCorregir.length; i += CHUNK) {
    const batch = db.batch();
    const slice = aCorregir.slice(i, i + CHUNK);
    for (const d of slice) {
      batch.update(d.ref, { saldoPendiente: 0 });
    }
    await batch.commit();
    corregidos += slice.length;
    console.log(`  ✓ ${corregidos}/${aCorregir.length} corregidos`);
  }

  console.log('');
  console.log(`✅ Listo. ${corregidos} pedidos actualizados.`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
