// Backfill: añade `clienteEmail` a todos los pedidos_b2b que no lo tengan.
// Lee el email desde el documento referenciado por `clienteId` en clientes_corporativos.
//
// Uso (dry-run por defecto):
//   node scripts/backfill-pedidos-b2b-cliente-email.js
// Para aplicar cambios:
//   node scripts/backfill-pedidos-b2b-cliente-email.js --apply
//
// Requiere serviceAccountKey.json en la raíz del repo.

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

async function backfill() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  BACKFILL: clienteEmail en pedidos_b2b');
  console.log(`  Modo: ${APPLY ? '🔴 APLICAR CAMBIOS' : '🟢 DRY-RUN (sin cambios)'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Cargar todos los clientes corporativos a un mapa { docId → email }
  console.log('📋 Cargando clientes_corporativos...');
  const clientesSnap = await db.collection('clientes_corporativos').get();
  const emailPorClienteId = new Map();
  clientesSnap.forEach((doc) => {
    const data = doc.data();
    const email = data?.credenciales?.email;
    if (email) emailPorClienteId.set(doc.id, email);
  });
  console.log(`   ${clientesSnap.size} clientes cargados, ${emailPorClienteId.size} con email.\n`);

  // 2. Escanear pedidos_b2b
  console.log('📦 Escaneando pedidos_b2b...');
  const pedidosSnap = await db.collection('pedidos_b2b').get();
  console.log(`   ${pedidosSnap.size} pedidos encontrados.\n`);

  const aCorregir = [];
  const sinClienteId = [];
  const clienteNoEncontrado = [];
  const yaTenian = [];

  pedidosSnap.forEach((doc) => {
    const data = doc.data();
    const numero = data.numeroPedido || doc.id.slice(0, 6);

    if (data.clienteEmail) {
      yaTenian.push(numero);
      return;
    }
    if (!data.clienteId) {
      sinClienteId.push(numero);
      return;
    }
    const email = emailPorClienteId.get(data.clienteId);
    if (!email) {
      clienteNoEncontrado.push({ numero, clienteId: data.clienteId });
      return;
    }
    aCorregir.push({ docId: doc.id, numero, email, clienteId: data.clienteId });
  });

  console.log(`📊 Resumen:`);
  console.log(`   ✓ Ya tenían clienteEmail: ${yaTenian.length}`);
  console.log(`   ✗ Sin clienteId (no se pueden corregir): ${sinClienteId.length}`);
  console.log(`   ✗ clienteId no existe en clientes_corporativos: ${clienteNoEncontrado.length}`);
  console.log(`   ➜ A corregir: ${aCorregir.length}\n`);

  if (sinClienteId.length > 0) {
    console.log(`⚠️ Pedidos sin clienteId (revisar manualmente):`);
    sinClienteId.slice(0, 10).forEach((n) => console.log(`   - #${String(n).padStart(4, '0')}`));
    if (sinClienteId.length > 10) console.log(`   ... y ${sinClienteId.length - 10} más`);
    console.log('');
  }

  if (clienteNoEncontrado.length > 0) {
    console.log(`⚠️ Pedidos con clienteId huérfano (cliente fue eliminado):`);
    clienteNoEncontrado.slice(0, 10).forEach(({ numero, clienteId }) =>
      console.log(`   - #${String(numero).padStart(4, '0')} → clienteId: ${clienteId}`)
    );
    if (clienteNoEncontrado.length > 10) console.log(`   ... y ${clienteNoEncontrado.length - 10} más`);
    console.log('');
  }

  if (aCorregir.length === 0) {
    console.log('✅ No hay pedidos por corregir.\n');
    return;
  }

  if (!APPLY) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  DRY-RUN: no se escribió nada.');
    console.log('  Para aplicar:');
    console.log('  node scripts/backfill-pedidos-b2b-cliente-email.js --apply');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📋 Ejemplo de los primeros 5 a corregir:`);
    aCorregir.slice(0, 5).forEach(({ numero, email }) =>
      console.log(`   - #${String(numero).padStart(4, '0')} → ${email}`)
    );
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  APLICANDO CORRECCIÓN...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let batch = db.batch();
  let opsEnBatch = 0;
  let totalAplicadas = 0;

  for (const { docId, email } of aCorregir) {
    batch.update(db.collection('pedidos_b2b').doc(docId), {
      clienteEmail: email,
      backfilledClienteEmailAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    opsEnBatch++;
    totalAplicadas++;

    if (opsEnBatch >= 400) {
      await batch.commit();
      console.log(`   Batch commiteado: ${totalAplicadas}/${aCorregir.length}`);
      batch = db.batch();
      opsEnBatch = 0;
    }
  }
  if (opsEnBatch > 0) {
    await batch.commit();
  }

  console.log(`\n✅ ${totalAplicadas} pedidos actualizados con clienteEmail.\n`);
}

backfill()
  .then(() => {
    console.log('Listo.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
