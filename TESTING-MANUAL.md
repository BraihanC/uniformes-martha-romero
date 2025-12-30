# Guía de Testing Manual - Pedidos

Esta guía te ayudará a verificar que la funcionalidad de Pedidos funciona correctamente después de hacer cambios en el código.

## ✅ Checklist de Testing

### 1. Crear un Pedido Nuevo

#### Pasos:
1. Ir a la sección "Pedidos"
2. Hacer clic en "Crear Nuevo Pedido"
3. Seleccionar un cliente
4. Agregar productos al carrito
5. Ingresar un abono inicial (opcional)
6. Hacer clic en "Guardar Pedido"

#### Verificaciones:
- ✅ El pedido se crea exitosamente sin errores
- ✅ Se genera un número de pedido único
- ✅ Se muestra un alert de confirmación
- ✅ El pedido aparece en la lista de pedidos

### 2. Reserva de Stock al Crear Pedido

#### Pasos:
1. Antes de crear el pedido, anotar el **RES. PEDIDOS** del producto en Inventario
2. Crear un pedido con ese producto (por ejemplo, 2 unidades)
3. Verificar el **RES. PEDIDOS** del producto en Inventario después

#### Verificaciones:
- ✅ **RES. PEDIDOS** aumentó en la cantidad correcta (2 unidades)
- ✅ **STOCK TOTAL** NO cambió (las prendas no existen físicamente aún)
- ✅ **STOCK DISP.** disminuyó correctamente

#### Fórmula esperada:
```
Stock Disponible = STOCK TOTAL - RES. PEDIDOS - RES. APARTADOS
```

### 3. Entrada de Productos (Satélite/Proveedor)

#### Pasos:
1. Ir a "Entrada de Producto" → "Satélite" o "Proveedor"
2. Seleccionar un pedido existente
3. Seleccionar un producto del pedido
4. Ingresar cantidad que llegó
5. Guardar la entrada

#### Verificaciones:
- ✅ **STOCK TOTAL** aumenta por la cantidad que llegó
- ✅ **RES. PEDIDOS** NO cambia (ya estaba reservado)
- ✅ El item del pedido cambia a "Listo para Entrega"
- ✅ **STOCK DISP.** se mantiene igual o aumenta

### 4. Estructura de Datos del Carrito

#### En la Consola del Navegador (F12):
```javascript
// Verificar estructura de cartItems
console.log(cartItems);

// Estructura esperada:
{
  product: {
    id: "prod123",
    nombre: "BLUSA MA DIARIO",
    talla: "S",
    precio: 62000,
    referencia: "MA003TS"
  },
  cantidad: 2,
  precio: 62000
}
```

#### Verificaciones:
- ✅ Cada item tiene `product.id` (no `productoId`)
- ✅ `product` es un objeto completo
- ✅ `cantidad` y `precio` son números válidos

### 5. Cálculos de Totales

#### Test Manual:
```
Producto 1: 2 unidades × $50,000 = $100,000
Producto 2: 1 unidad  × $30,000 = $30,000
Producto 3: 3 unidades × $20,000 = $60,000
─────────────────────────────────────────────
TOTAL PEDIDO:                       $190,000
ABONO:                              $50,000
─────────────────────────────────────────────
SALDO PENDIENTE:                    $140,000
```

#### Verificaciones:
- ✅ Total del pedido = suma de (cantidad × precio)
- ✅ Saldo pendiente = total - abono
- ✅ Los totales se muestran correctamente en la interfaz

### 6. Validaciones

#### Productos Duplicados:
1. Agregar un producto al carrito
2. Intentar agregar el mismo producto de nuevo

**Esperado:** ❌ Debe mostrar: "Este producto ya está en el carrito"

#### Cantidades:
1. Intentar ingresar cantidad = 0
2. Intentar ingresar cantidad negativa

**Esperado:** ❌ Debe rechazar valores inválidos

#### Abono Mayor que Total:
1. Total del pedido: $100,000
2. Intentar ingresar abono: $150,000

**Esperado:** ⚠️ El sistema debería validar esto (verifica que funcione)

### 7. Corrección de Pedidos

#### Pasos:
1. Seleccionar un pedido existente
2. Hacer clic en "Gestionar Pedido"
3. Hacer clic en "Corregir Producto"
4. Cambiar un producto por otro
5. Guardar la corrección

#### Verificaciones:
- ✅ El pedido se actualiza correctamente
- ✅ **RES. PEDIDOS** del producto anterior disminuye
- ✅ **RES. PEDIDOS** del producto nuevo aumenta
- ✅ El stock se ajusta correctamente

### 8. Anulación de Pedidos

#### Pasos:
1. Seleccionar un pedido existente
2. Hacer clic en "Anular Pedido"
3. Confirmar la anulación

#### Verificaciones:
- ✅ El pedido se marca como "Anulado"
- ✅ **RES. PEDIDOS** de todos los productos disminuye
- ✅ **STOCK DISP.** aumenta correctamente

### 9. Stock Disponible Negativo (Sobreventa)

#### Escenario:
```
STOCK TOTAL:       10 unidades
RES. PEDIDOS:      25 unidades
RES. APARTADOS:     5 unidades
──────────────────────────────
STOCK DISPONIBLE: -20 unidades ✅ (esto es correcto)
```

#### Verificaciones:
- ✅ El sistema permite stock disponible negativo
- ✅ Se puede ver el número negativo en inventario
- ✅ Indica que hay 20 unidades pendientes de producir

### 10. Estados de Items en Pedidos

#### Estados válidos:
- "En Producción" - Cuando se crea el pedido
- "Listo para Entrega" - Cuando llega el producto
- "Entregado" - Cuando se entrega al cliente

#### Verificaciones:
- ✅ Items nuevos inician en "En Producción"
- ✅ Cambian a "Listo para Entrega" al registrar entrada
- ✅ Cambian a "Entregado" al completar la entrega

## 🐛 Problemas Comunes y Soluciones

### Error: "Cannot read properties of undefined (reading 'indexOf')"
**Causa:** `item.productoId` es undefined
**Solución:** Verificar que se use `item.product.id` en lugar de `item.productoId`

### Error: "Missing or insufficient permissions"
**Causa:** Reglas de Firestore bloqueando la operación
**Solución:** Verificar reglas de seguridad en Firebase Console

### Stock no se actualiza
**Causa:** Batch commit falló silenciosamente
**Solución:** Revisar consola del navegador para errores

### Stock Disponible incorrecto
**Fórmula correcta:**
```javascript
const stockDisponible = stockTotal - stockReservadoPedidos - stockReservadoApartados;
```

## 📝 Registro de Cambios a Verificar

Cuando hagas cambios en el código, usa esta lista para verificar:

- [ ] Los pedidos se crean sin errores
- [ ] El stock se reserva al crear el pedido
- [ ] El stock NO se reserva doble al recibir productos
- [ ] Los cálculos de totales son correctos
- [ ] Las correcciones ajustan el stock correctamente
- [ ] Las anulaciones liberan el stock
- [ ] La interfaz muestra los datos correctos

## 🔍 Depuración

### Ver el estado actual en la consola:
```javascript
// En la Consola del Navegador (F12):

// Ver productos en el carrito
console.log('Cart Items:', cartItems);

// Ver un producto específico del inventario
console.log('Producto:', allProducts.find(p => p.referencia === 'MA003TS'));

// Ver todos los pedidos
console.log('Pedidos:', pedidos);
```

### Verificar en Firestore:
1. Ir a Firebase Console
2. Firestore Database
3. Revisar colección `pedidos`
4. Revisar colección `products`
5. Verificar que los valores coincidan

## ✅ Criterios de Aceptación

Un cambio en el código es EXITOSO si:

1. ✅ Puedes crear un pedido nuevo
2. ✅ El stock se reserva correctamente
3. ✅ No aparecen errores en la consola
4. ✅ Los cálculos son precisos
5. ✅ El inventario refleja los cambios
6. ✅ Puedes corregir y anular pedidos
7. ✅ La interfaz es responsive

---

**Fecha:** 27 de diciembre de 2025
**Versión:** 1.0
**Mantenido por:** Claude Code
