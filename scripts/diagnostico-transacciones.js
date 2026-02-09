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

async function diagnosticarTransacciones() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  DIAGNÓSTICO DE TRANSACCIONES - CIERRE DE CAJA');
    console.log('═══════════════════════════════════════════════════════\n');

    // Fecha de hoy (Colombia timezone)
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

    console.log(`📅 Fecha: ${inicioHoy.toLocaleDateString('es-CO')}\n`);

    // ═══════════════════════════════════════════════════════
    // 1. BUSCAR TRANSACCIONES PROBLEMÁTICAS (TODAS LAS FECHAS)
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  1. TRANSACCIONES CON BUG DE ANULACIÓN (TODAS LAS FECHAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Buscar transacciones con metodoPago: 'Devolución' (del bug viejo)
    const bugDevolucionSnap = await db.collection('transactions')
      .where('metodoPago', '==', 'Devolución')
      .get();

    console.log(`🔍 Transacciones con metodoPago='Devolución': ${bugDevolucionSnap.size}\n`);

    const transaccionesProblematicas = [];

    bugDevolucionSnap.docs.forEach(doc => {
      const data = doc.data();
      const fecha = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
      transaccionesProblematicas.push({
        id: doc.id,
        ...data,
        fechaFormateada: fecha.toLocaleString('es-CO')
      });

      console.log(`  📄 ID: ${doc.id}`);
      console.log(`     Tipo: ${data.tipo}`);
      console.log(`     Monto: $${(data.monto || 0).toLocaleString('es-CO')}`);
      console.log(`     Método: ${data.metodoPago}`);
      console.log(`     Descripción: ${data.descripcion || data.concepto || 'N/A'}`);
      console.log(`     Pedido: #${data.numeroPedido || 'N/A'}`);
      console.log(`     Fecha: ${fecha.toLocaleString('es-CO')}`);
      console.log(`     Anulada: ${data.anulada || false}`);
      console.log(`     ⚠️  PROBLEMA: monto ${data.monto > 0 ? 'POSITIVO' : 'negativo'} con método 'Devolución'`);
      console.log(`     ✏️  CORRECCIÓN: monto debería ser ${-Math.abs(data.monto)}, método debería ser 'Efectivo'`);
      console.log('');
    });

    // Buscar transacciones tipo egreso con monto positivo (otro síntoma del bug)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  2. EGRESOS CON MONTO POSITIVO (TODAS LAS FECHAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const egresosSnap = await db.collection('transactions')
      .where('tipo', '==', 'egreso')
      .get();

    let egresosPositivos = 0;
    egresosSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.monto > 0 && data.anulada !== true) {
        egresosPositivos++;
        const fecha = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);

        console.log(`  📄 ID: ${doc.id}`);
        console.log(`     Monto: +$${data.monto.toLocaleString('es-CO')} (POSITIVO - ERROR)`);
        console.log(`     Método: ${data.metodoPago}`);
        console.log(`     Descripción: ${data.descripcion || data.concepto || data.categoria || 'N/A'}`);
        console.log(`     Fecha: ${fecha.toLocaleString('es-CO')}`);
        console.log(`     ⚠️  Un egreso SIEMPRE debe ser negativo`);
        console.log('');

        // Agregar a problemáticas si no está ya
        const yaExiste = transaccionesProblematicas.find(t => t.id === doc.id);
        if (!yaExiste) {
          transaccionesProblematicas.push({
            id: doc.id,
            ...data,
            fechaFormateada: fecha.toLocaleString('es-CO')
          });
        }
      }
    });

    console.log(`🔍 Total egresos con monto positivo (no anulados): ${egresosPositivos}\n`);

    // ═══════════════════════════════════════════════════════
    // 3. TRANSACCIONES DE HOY - ANÁLISIS COMPLETO
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  3. ANÁLISIS DE TRANSACCIONES DE HOY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const startTimestamp = admin.firestore.Timestamp.fromDate(inicioHoy);
    const endTimestamp = admin.firestore.Timestamp.fromDate(finHoy);

    const hoySnap = await db.collection('transactions')
      .where('fecha', '>=', startTimestamp)
      .where('fecha', '<=', endTimestamp)
      .get();

    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalRetiros = 0;
    let totalIngresosEfectivo = 0;
    let totalEgresosEfectivo = 0;
    const porMetodo = {};
    const porTipo = {};
    let transaccionesHoy = 0;
    let anuladas = 0;
    let pendientes = 0;

    hoySnap.docs.forEach(doc => {
      const data = doc.data();

      // Excluir anuladas
      if (data.anulada === true) {
        anuladas++;
        return;
      }

      // Excluir pendientes
      if (data.metodoPago === 'Pendiente') {
        pendientes++;
        return;
      }

      // Para entradas de satélite: solo incluir si afectaCaja es true
      if (data.tipo === 'entrada_satelite' && data.afectaCaja !== true) {
        return;
      }

      transaccionesHoy++;
      const monto = data.monto || 0;
      const metodo = data.metodoPago || 'Indefinido';
      const tipo = data.tipo || 'Indefinido';

      // Procesar retiros de caja por separado
      if (tipo === 'retiro_caja') {
        totalRetiros += Math.abs(monto);
      } else if (monto > 0) {
        totalIngresos += monto;
        if (metodo === 'Efectivo') {
          totalIngresosEfectivo += monto;
        }
      } else {
        totalEgresos += monto;
        if (metodo === 'Efectivo') {
          totalEgresosEfectivo += monto;
        }
      }

      // Agrupar por método
      if (tipo !== 'retiro_caja') {
        if (!porMetodo[metodo]) porMetodo[metodo] = { ingresos: 0, egresos: 0, total: 0 };
        porMetodo[metodo].total += monto;
        if (monto > 0) porMetodo[metodo].ingresos += monto;
        else porMetodo[metodo].egresos += monto;
      }

      // Agrupar por tipo
      if (!porTipo[tipo]) porTipo[tipo] = { total: 0, count: 0 };
      porTipo[tipo].total += monto;
      porTipo[tipo].count++;
    });

    const saldoNeto = totalIngresos + totalEgresos;
    const saldoNetoEfectivo = totalIngresosEfectivo + totalEgresosEfectivo;

    console.log(`  Transacciones activas: ${transaccionesHoy}`);
    console.log(`  Transacciones anuladas: ${anuladas}`);
    console.log(`  Transacciones pendientes: ${pendientes}`);
    console.log('');

    console.log('  📊 RESUMEN GENERAL:');
    console.log(`     Total Ingresos: $${totalIngresos.toLocaleString('es-CO')}`);
    console.log(`     Total Egresos:  -$${Math.abs(totalEgresos).toLocaleString('es-CO')}`);
    console.log(`     Saldo Neto:     $${saldoNeto.toLocaleString('es-CO')}`);
    console.log(`     Retiros:        $${totalRetiros.toLocaleString('es-CO')}`);
    console.log('');

    console.log('  💵 DESGLOSE EFECTIVO:');
    console.log(`     Ingresos Efectivo: $${totalIngresosEfectivo.toLocaleString('es-CO')}`);
    console.log(`     Egresos Efectivo:  -$${Math.abs(totalEgresosEfectivo).toLocaleString('es-CO')}`);
    console.log(`     Saldo Neto Efectivo: $${saldoNetoEfectivo.toLocaleString('es-CO')}`);
    console.log('');

    // Obtener base inicial
    const basesSnap = await db.collection('bases_caja')
      .where('fecha', '==', inicioHoy.toISOString().split('T')[0])
      .get();

    let baseInicial = 0;
    if (!basesSnap.empty) {
      baseInicial = basesSnap.docs[0].data().monto || 0;
    }

    const efectivoEsperado = baseInicial + saldoNetoEfectivo - totalRetiros;

    console.log('  🏦 CÁLCULO EFECTIVO ESPERADO:');
    console.log(`     Base Inicial:          $${baseInicial.toLocaleString('es-CO')}`);
    console.log(`     + Saldo Neto Efectivo: $${saldoNetoEfectivo.toLocaleString('es-CO')}`);
    console.log(`     - Retiros:             $${totalRetiros.toLocaleString('es-CO')}`);
    console.log(`     ─────────────────────────────────`);
    console.log(`     = Efectivo Esperado:   $${efectivoEsperado.toLocaleString('es-CO')}`);
    console.log('');

    console.log('  💳 DESGLOSE POR MÉTODO:');
    Object.keys(porMetodo).sort().forEach(metodo => {
      const m = porMetodo[metodo];
      console.log(`     ${metodo}:`);
      console.log(`       Ingresos: $${m.ingresos.toLocaleString('es-CO')}`);
      console.log(`       Egresos:  -$${Math.abs(m.egresos).toLocaleString('es-CO')}`);
      console.log(`       Neto:     $${m.total.toLocaleString('es-CO')}`);
    });
    console.log('');

    console.log('  📋 DESGLOSE POR TIPO:');
    Object.keys(porTipo).sort().forEach(tipo => {
      const t = porTipo[tipo];
      console.log(`     ${tipo}: $${t.total.toLocaleString('es-CO')} (${t.count} trans.)`);
    });
    console.log('');

    // ═══════════════════════════════════════════════════════
    // 4. TRANSACCIONES ANULADAS DE HOY (para verificar)
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  4. TRANSACCIONES ANULADAS DE HOY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let totalAnuladasEfectivo = 0;
    hoySnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.anulada === true) {
        const fecha = data.fecha?.toDate ? data.fecha.toDate() : new Date(data.fecha);
        const metodo = data.metodoPago || 'Indefinido';
        const monto = data.monto || 0;

        if (metodo === 'Efectivo') {
          totalAnuladasEfectivo += monto;
        }

        console.log(`  📄 ID: ${doc.id}`);
        console.log(`     Tipo: ${data.tipo}`);
        console.log(`     Monto: $${monto.toLocaleString('es-CO')}`);
        console.log(`     Método: ${metodo}`);
        console.log(`     Descripción: ${data.descripcion || data.concepto || 'N/A'}`);
        console.log(`     Pedido: ${data.numeroPedido ? '#' + data.numeroPedido : data.pedidoId || 'N/A'}`);
        console.log(`     Motivo anulación: ${data.motivoAnulacion || 'N/A'}`);
        console.log('');
      }
    });

    console.log(`  Total monto anuladas en Efectivo (excluido del reporte): $${totalAnuladasEfectivo.toLocaleString('es-CO')}\n`);

    // ═══════════════════════════════════════════════════════
    // 5. RESUMEN DE PROBLEMAS Y SOLUCIONES
    // ═══════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  5. RESUMEN DE PROBLEMAS ENCONTRADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (transaccionesProblematicas.length === 0) {
      console.log('  ✅ No se encontraron transacciones problemáticas\n');
    } else {
      console.log(`  ⚠️  Se encontraron ${transaccionesProblematicas.length} transacciones problemáticas:\n`);
      transaccionesProblematicas.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.descripcion || t.concepto || 'Sin descripción'}`);
        console.log(`     ID: ${t.id}`);
        console.log(`     Monto actual: $${(t.monto || 0).toLocaleString('es-CO')}`);
        console.log(`     Método actual: ${t.metodoPago}`);
        console.log(`     → Monto correcto: -$${Math.abs(t.monto || 0).toLocaleString('es-CO')}`);
        console.log(`     → Método correcto: Efectivo`);
        console.log('');
      });

      console.log('  Para corregir, ejecuta: node scripts/corregir-transacciones-anulaciones.js');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  FIN DEL DIAGNÓSTICO');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

diagnosticarTransacciones();
