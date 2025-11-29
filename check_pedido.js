// ========================================
// SCRIPT DE DIAGNÓSTICO - JARDINERA MA DIARIO TALLA 16
// ========================================
// Este script investiga por qué stockReservadoPedidos = -1
//
// CÓMO USAR:
// 1. Abre Firebase Console
// 2. Ve a Firestore Database
// 3. Busca el producto con referencia MA002T16
// 4. Anota el ID del documento
// 5. Reemplaza PRODUCT_ID_AQUI con el ID real
// 6. Ejecuta este script en la consola del navegador
// ========================================

// PASO 1: Configuración
const PRODUCT_ID = 'S3E8o11r0AU0Sg3j89cg'; // ID del documento en Firestore
const REFERENCIA = 'MA002T16';

console.log('🔍 DIAGNÓSTICO: JARDINERA MA DIARIO TALLA 16');
console.log('============================================\n');

// PASO 2: Query en Firebase Console
console.log('📋 CONSULTAS PARA EJECUTAR EN FIREBASE CONSOLE:\n');

console.log('1️⃣ BUSCAR TRANSACCIONES:');
console.log('   Colección: transactions');
console.log('   Filtro: productId == "' + PRODUCT_ID + '"');
console.log('   Ordenar por: createdAt desc\n');

console.log('2️⃣ BUSCAR PEDIDOS:');
console.log('   Colección: pedidos');
console.log('   Filtro: items array-contains-any ["' + REFERENCIA + '"]');
console.log('   (Nota: Deberás revisar manualmente cada pedido)\n');

console.log('3️⃣ BUSCAR APARTADOS:');
console.log('   Colección: apartados');
console.log('   Filtro: items array-contains-any ["' + REFERENCIA + '"]');
console.log('   (Nota: Deberás revisar manualmente cada apartado)\n');

console.log('4️⃣ BUSCAR FACTURAS:');
console.log('   Colección: ventas');
console.log('   Filtro: items array-contains-any ["' + REFERENCIA + '"]');
console.log('   (Nota: Deberás revisar manualmente cada factura)\n');

console.log('\n📊 QUÉ BUSCAR:');
console.log('===============\n');

console.log('En PEDIDOS, busca:');
console.log('  - Items con referencia: ' + REFERENCIA);
console.log('  - Item.estadoItem: "En Producción" o "Listo para Entrega"');
console.log('  - Si encuentras alguno, suma las cantidades\n');

console.log('En APARTADOS activos, busca:');
console.log('  - Items con referencia: ' + REFERENCIA);
console.log('  - estadoGeneral != "Completado" y != "Vencido"');
console.log('  - Si encuentras alguno, suma las cantidades\n');

console.log('En TRANSACCIONES, busca:');
console.log('  - tipo: "abono_pedido" → Esto aumenta reservaPedidos');
console.log('  - tipo: "venta" → Esto disminuye reservaPedidos si viene de pedido');
console.log('  - Cuenta cuántas aumentan y cuántas disminuyen\n');

console.log('\n⚠️ POSIBLES CAUSAS DEL PROBLEMA:');
console.log('=================================\n');

console.log('1. Se facturó/entregó un pedido pero el producto no existía');
console.log('   → El código intentó liberar stock que no estaba reservado');
console.log('   → Resultado: stockReservadoPedidos = 0 - 1 = -1\n');

console.log('2. Se corrigió un producto en un pedido');
console.log('   → El producto antiguo liberó stock incorrectamente');
console.log('   → Resultado: stockReservadoPedidos quedó negativo\n');

console.log('3. Se eliminó un pedido manualmente en Firebase');
console.log('   → No se ejecutó la lógica de liberar stock');
console.log('   → Resultado: Stock quedó inconsistente\n');

console.log('4. Error en la validación de entrega');
console.log('   → Se permitió entregar más unidades de las reservadas');
console.log('   → Resultado: stockReservadoPedidos quedó negativo\n');

console.log('\n✅ SOLUCIÓN INMEDIATA:');
console.log('=====================\n');

console.log('En Firebase Console:');
console.log('1. Ve a: products/S3E8o11r0AU0Sg3j89cg');
console.log('2. Haz clic en el ícono de lápiz (editar)');
console.log('3. Corrige estos campos:\n');
console.log('   🔧 stockReservadoPedidos: -1 → 0');
console.log('   🔧 stockDisponible: 1 → 0');
console.log('   ✓ stockTotal: mantener en 0');
console.log('   ✓ stockReservadoApartados: mantener en 0\n');

console.log('Valores correctos finales:');
console.log('   ┌─────────────────────────────┬─────┐');
console.log('   │ stockTotal                  │  0  │');
console.log('   │ stockDisponible             │  0  │');
console.log('   │ stockReservadoPedidos       │  0  │');
console.log('   │ stockReservadoApartados     │  0  │');
console.log('   └─────────────────────────────┴─────┘\n');

console.log('\n🔧 SOLUCIÓN A LARGO PLAZO:');
console.log('===========================\n');

console.log('Implementar validaciones adicionales:');
console.log('1. Al entregar pedidos, validar que stockReservadoPedidos >= cantidad');
console.log('2. Al corregir productos, usar transacciones atómicas');
console.log('3. Crear función de auditoría de inventario');
console.log('4. Agregar constraints para evitar valores negativos\n');

console.log('\n💡 SIGUIENTE PASO:');
console.log('==================\n');
console.log('Una vez corregido manualmente, revisa las transacciones');
console.log('para identificar qué operación causó el problema y');
console.log('agregar validaciones para prevenir que vuelva a pasar.\n');
