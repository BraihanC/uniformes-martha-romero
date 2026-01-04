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

### 2. Campos de Stock al Crear Pedido

#### Pasos:
1. Antes de crear el pedido, anotar **TOTAL PEDIDAS** y **RES. PEDIDOS** del producto en Inventario
2. Crear un pedido con ese producto (por ejemplo, 2 unidades)
3. Verificar los campos del producto en Inventario después

#### Verificaciones:
- ✅ **TOTAL PEDIDAS** aumentó en la cantidad correcta (2 unidades) - Campo informativo para producción
- ✅ **RES. PEDIDOS** NO cambió (permanece en 0 hasta que items estén "Listo para Entrega")
- ✅ **STOCK TOTAL** NO cambió (las prendas no existen físicamente aún)
- ✅ **STOCK DISP.** NO cambió (porque RES. PEDIDOS no aumentó)
- ✅ Todos los items inician en estado "En Producción"

#### Fórmula esperada:
```
Stock Disponible = STOCK TOTAL - RES. PEDIDOS - RES. APARTADOS
Total Pedidas = Campo informativo que NO afecta Stock Disponible
```

### 3. Entrada de Productos (Satélite/Proveedor)

#### Pasos:
1. Ir a "Entrada de Producto" → "Satélite" o "Proveedor"
2. Seleccionar un pedido existente
3. Seleccionar un producto del pedido
4. Ingresar cantidad que llegó
5. Guardar la entrada

#### Verificaciones:
- ✅ **STOCK TOTAL** aumenta por la cantidad que llegó (inventario físico)
- ✅ **RES. PEDIDOS** SÍ aumenta cuando items pasan a "Listo para Entrega"
- ✅ **TOTAL PEDIDAS** NO cambia (ya se incrementó al crear el pedido)
- ✅ El item del pedido cambia a "Listo para Entrega"
- ✅ **STOCK DISP.** puede disminuir o mantenerse según cuántas unidades llegaron

#### Ejemplo:
```
ANTES de la entrada:
- Stock Total: 5
- Total Pedidas: 10 (hay 10 prendas pedidas)
- Res. Pedidos: 0 (ninguna lista aún)
- Stock Disp.: 5

DESPUÉS de entrada de 3 unidades asignadas a pedido:
- Stock Total: 8 (llegaron 3)
- Total Pedidas: 10 (no cambia)
- Res. Pedidos: 3 (las 3 que llegaron están "Listo para Entrega")
- Stock Disp.: 5 (8 - 3 = 5)
```

### 3b. Cambio Manual de Estado (Sin Entrada de Productos)

#### Pasos:
1. Ir a "Pedidos"
2. Seleccionar un pedido con items en "En Producción"
3. Cambiar manualmente el estado de un item a "Listo para Entrega"
4. Verificar los campos en Inventario

#### Verificaciones:
- ✅ **RES. PEDIDOS** SÍ aumenta (asume que se usa stock existente)
- ✅ **STOCK TOTAL** NO cambia (no llegó inventario nuevo)
- ✅ **TOTAL PEDIDAS** NO cambia
- ✅ **STOCK DISP.** disminuye por la reserva

#### Ejemplo:
```
ANTES del cambio manual:
- Stock Total: 10
- Total Pedidas: 5
- Res. Pedidos: 0
- Stock Disp.: 10

DESPUÉS de cambiar 2 items a "Listo para Entrega":
- Stock Total: 10 (no cambia)
- Total Pedidas: 5 (no cambia)
- Res. Pedidos: 2 (se reservan del stock existente)
- Stock Disp.: 8 (10 - 2 = 8)
```

⚠️ **Diferencia clave:**
- **Entrada de productos**: Incrementa STOCK TOTAL + RES. PEDIDOS
- **Cambio manual**: Solo incrementa RES. PEDIDOS (usa stock existente)

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

#### Verificaciones (Producto Anterior):
- ✅ **TOTAL PEDIDAS** disminuye
- ✅ **RES. PEDIDOS** disminuye SI el item estaba en "Listo para Entrega"
- ✅ **STOCK TOTAL** NO cambia

#### Verificaciones (Producto Nuevo):
- ✅ **TOTAL PEDIDAS** aumenta
- ✅ **RES. PEDIDOS** aumenta SI el nuevo item se marca "Listo para Entrega"
- ✅ **STOCK TOTAL** NO cambia
- ✅ El nuevo item hereda el estado del item anterior

### 8. Anulación de Pedidos

#### Pasos:
1. Seleccionar un pedido existente
2. Hacer clic en "Anular Pedido"
3. Confirmar la anulación

#### Verificaciones:
- ✅ El pedido se marca como "Anulado"
- ✅ **TOTAL PEDIDAS** disminuye para todos los productos
- ✅ **RES. PEDIDOS** disminuye SOLO para items que estaban en "Listo para Entrega"
- ✅ **STOCK TOTAL** NO cambia
- ✅ **STOCK DISP.** aumenta por la liberación de reservas (solo items listos)

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

#### Estados válidos y su impacto en inventario:

**"En Producción"** - Estado inicial al crear el pedido
- ✅ **TOTAL PEDIDAS**: Se incrementa al crear
- ✅ **RES. PEDIDOS**: NO se incrementa (aún no reserva stock)
- ✅ **STOCK TOTAL**: NO cambia
- ✅ **STOCK DISP.**: NO cambia

**"Listo para Entrega"** - Cuando llega el producto o se marca manualmente
- ✅ **TOTAL PEDIDAS**: Ya estaba incrementado, no cambia
- ✅ **RES. PEDIDOS**: SE INCREMENTA al pasar a este estado
- ✅ **STOCK TOTAL**: Aumenta si llegó por Entrada, NO cambia si fue manual
- ✅ **STOCK DISP.**: Puede disminuir o mantenerse según el flujo

**"Entregado"** - Cuando se entrega al cliente
- ✅ **TOTAL PEDIDAS**: Disminuye al entregar
- ✅ **RES. PEDIDOS**: Disminuye al entregar
- ✅ **STOCK TOTAL**: Disminuye al entregar
- ✅ **STOCK DISP.**: Puede aumentar (se libera la reserva)

#### Verificaciones:
- ✅ Items nuevos inician en "En Producción"
- ✅ Cambian a "Listo para Entrega" automáticamente al registrar entrada
- ✅ Pueden cambiarse manualmente a "Listo para Entrega" (usa stock existente)
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
- [ ] **TOTAL PEDIDAS** se incrementa al crear el pedido
- [ ] **RES. PEDIDOS** NO se incrementa al crear (solo al pasar a "Listo")
- [ ] **RES. PEDIDOS** SÍ se incrementa al marcar "Listo para Entrega"
- [ ] Entrada de productos incrementa **STOCK TOTAL** + **RES. PEDIDOS**
- [ ] Cambio manual solo incrementa **RES. PEDIDOS** (no STOCK TOTAL)
- [ ] Los cálculos de totales son correctos
- [ ] Las correcciones ajustan ambos campos correctamente
- [ ] Las anulaciones liberan ambos campos correctamente
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

1. ✅ Puedes crear un pedido nuevo sin errores
2. ✅ **TOTAL PEDIDAS** se incrementa correctamente al crear
3. ✅ **RES. PEDIDOS** solo se incrementa al pasar a "Listo para Entrega"
4. ✅ Entrada de productos actualiza ambos: STOCK TOTAL y RES. PEDIDOS
5. ✅ Cambio manual solo actualiza RES. PEDIDOS (no STOCK TOTAL)
6. ✅ Los cálculos de totales y saldos son precisos
7. ✅ El inventario refleja correctamente los 3 campos (TOTAL PEDIDAS, RES. PEDIDOS, STOCK TOTAL)
8. ✅ Stock Disponible = STOCK TOTAL - RES. PEDIDOS - RES. APARTADOS
9. ✅ Puedes corregir y anular pedidos liberando ambos campos
10. ✅ No aparecen errores en la consola del navegador
11. ✅ La interfaz es responsive y muestra los datos correctos

---

**Fecha:** 4 de enero de 2026
**Versión:** 2.0 - Actualizado con sistema dual de campos (TOTAL PEDIDAS + RES. PEDIDOS)
**Mantenido por:** Claude Code
