/**
 * Script para Corregir el Inventario
 *
 * Este script corrige las discrepancias en el stockTotal de los productos
 * basándose en el archivo de correcciones generado por la auditoría.
 *
 * IMPORTANTE: Este script modifica datos en producción. ¡Usar con cuidado!
 *
 * Ejecutar con: node scripts/corregirInventario.cjs
 *
 * Para corregir un solo producto:
 * node scripts/corregirInventario.cjs MA019T8
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Función para preguntar al usuario
function pregunta(texto) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(texto, (respuesta) => {
      rl.close();
      resolve(respuesta.toLowerCase());
    });
  });
}

async function corregirInventario(referenciaEspecifica = null) {
  console.log('========================================');
  console.log('CORRECCIÓN DE INVENTARIO');
  console.log('========================================\n');

  // Cargar archivo de correcciones
  const archivoPath = path.join(__dirname, 'correcciones_inventario.json');

  if (!fs.existsSync(archivoPath)) {
    console.log('ERROR: No se encontró el archivo de correcciones.');
    console.log('Ejecuta primero: node scripts/auditarInventarioCompleto.cjs');
    return;
  }

  let correcciones = JSON.parse(fs.readFileSync(archivoPath, 'utf8'));

  // Si se especificó una referencia, filtrar
  if (referenciaEspecifica) {
    correcciones = correcciones.filter(c =>
      c.referencia === referenciaEspecifica ||
      c.referencia.startsWith(referenciaEspecifica)
    );

    if (correcciones.length === 0) {
      console.log(`No se encontraron correcciones para: ${referenciaEspecifica}`);
      return;
    }
  }

  console.log(`Correcciones a aplicar: ${correcciones.length}\n`);

  // Filtrar solo correcciones donde el stock actual es MAYOR que el esperado
  // (productos donde no se descontaron las ventas)
  const correccionesPositivas = correcciones.filter(c => c.diferencia > 0);
  const correccionesNegativas = correcciones.filter(c => c.diferencia < 0);

  console.log(`Correcciones positivas (stock excedente): ${correccionesPositivas.length}`);
  console.log(`Correcciones negativas (stock faltante): ${correccionesNegativas.length}\n`);

  // Mostrar muestra de correcciones
  console.log('MUESTRA DE CORRECCIONES POSITIVAS (primeras 20):');
  console.log('-'.repeat(90));
  console.log('REFERENCIA\t\tACTUAL\tNUEVO\tDIF\tPRODUCTO');
  console.log('-'.repeat(90));

  correccionesPositivas.slice(0, 20).forEach(c => {
    const ref = c.referencia.padEnd(15);
    const nombre = c.nombre.substring(0, 30);
    console.log(`${ref}\t${c.stockActual}\t${c.stockCorregido}\t${c.diferencia > 0 ? '+' : ''}${c.diferencia}\t${nombre}`);
  });

  if (correccionesPositivas.length > 20) {
    console.log(`... y ${correccionesPositivas.length - 20} más`);
  }

  console.log('\n');

  // Preguntar confirmación
  const respuesta = await pregunta(
    '¿Deseas aplicar las correcciones POSITIVAS? Esto reducirá el stock de los productos afectados.\n' +
    'Escribe "si" para confirmar, o "no" para cancelar: '
  );

  if (respuesta !== 'si' && respuesta !== 'yes' && respuesta !== 's') {
    console.log('\nOperación cancelada por el usuario.');
    return;
  }

  console.log('\nAplicando correcciones...\n');

  // Aplicar correcciones en batches de 500
  const batchSize = 500;
  let corregidos = 0;
  let errores = 0;
  const logCorrecciones = [];

  for (let i = 0; i < correccionesPositivas.length; i += batchSize) {
    const batch = db.batch();
    const batchItems = correccionesPositivas.slice(i, i + batchSize);

    for (const correccion of batchItems) {
      try {
        const productRef = db.collection('products').doc(correccion.id);

        // Solo actualizar si el nuevo valor es >= 0
        const nuevoStock = Math.max(0, correccion.stockCorregido);

        batch.update(productRef, {
          stockTotal: nuevoStock,
          _correccionAuditoria: {
            stockAnterior: correccion.stockActual,
            stockNuevo: nuevoStock,
            diferencia: correccion.diferencia,
            fecha: admin.firestore.FieldValue.serverTimestamp(),
            motivo: 'Corrección por bug increment() en runTransaction'
          }
        });

        logCorrecciones.push({
          referencia: correccion.referencia,
          nombre: correccion.nombre,
          stockAnterior: correccion.stockActual,
          stockNuevo: nuevoStock,
          diferencia: correccion.diferencia
        });

        corregidos++;
      } catch (error) {
        console.error(`Error en ${correccion.referencia}:`, error.message);
        errores++;
      }
    }

    // Commit del batch
    try {
      await batch.commit();
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${batchItems.length} productos actualizados`);
    } catch (error) {
      console.error(`Error en batch:`, error.message);
      errores += batchItems.length;
      corregidos -= batchItems.length;
    }
  }

  // Guardar log de correcciones
  const logPath = path.join(__dirname, `log_correcciones_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(logCorrecciones, null, 2));

  console.log('\n========================================');
  console.log('RESULTADO');
  console.log('========================================\n');

  console.log(`Productos corregidos: ${corregidos}`);
  console.log(`Errores: ${errores}`);
  console.log(`Log guardado en: ${logPath}`);

  console.log('\n========================================');
  console.log('CORRECCIÓN COMPLETADA');
  console.log('========================================');
}

// Ejecutar
const referenciaArg = process.argv[2];
corregirInventario(referenciaArg)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
