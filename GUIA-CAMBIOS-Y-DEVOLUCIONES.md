# GUIA DE CAMBIOS Y DEVOLUCIONES - CAJA

---

## SITUACIONES COMUNES Y QUE HACER EN CADA UNA

Hay 3 situaciones principales que pueden pasar:

| Situacion | El pedido ya se facturo? | Donde se hace? |
|-----------|--------------------------|----------------|
| A. Cliente viene a medirse y la talla no le queda | NO | Pedidos |
| B. Cliente viene a cambiar un producto ya facturado | SI | Cambios y Devoluciones |
| C. Cliente quiere devolver un producto ya facturado | SI | Cambios y Devoluciones |
| D. Devolucion de factura + nuevo pedido (prenda no en stock) | SI | Devoluciones + Pedidos |

---

## SITUACION A: CAMBIO DE TALLA EN PEDIDO (SIN FACTURAR)

**Cuando pasa:** El pedido tiene productos listos pero NO se ha facturado todavia. El cliente viene a medirse y la prenda le queda pequena o grande.

### Pasos:

1. Ir a **Pedidos** en el menu lateral
2. Buscar el pedido del cliente y hacer clic en **Ver/Gestionar** (icono del ojo)
3. Se abre el modal "Gestionar Pedido #XXXX"
4. En la tabla de productos, buscar el producto que necesita cambio de talla
5. Hacer clic en el boton **"Talla"** (morado) en la columna de acciones
6. Se abre el modal **"Cambiar Talla de Producto"**
7. En el buscador, escribir el nombre o referencia de la prenda para encontrar la nueva talla
8. Seleccionar la nueva talla de la lista
9. Hacer clic en **"Cambiar Talla"**

**Que pasa por detras:**
- El producto con la talla vieja vuelve a stock disponible
- Se agrega el producto con la nueva talla en estado "En Produccion"
- El precio se mantiene igual
- NO se mueve dinero, NO se afecta la caja

**IMPORTANTE:** Este boton solo aparece cuando el producto esta en estado "Listo para Entrega", "Parcialmente Listo" o "Entregado".

---

## SITUACION A.2: CORREGIR PRODUCTO EN PEDIDO (SIN FACTURAR)

**Cuando pasa:** Necesitas cambiar completamente un producto por otro diferente dentro del pedido (no solo la talla, sino otro producto distinto), o cambiar la cantidad.

### Pasos:

1. Ir a **Pedidos** > buscar el pedido > **Ver/Gestionar**
2. En la tabla de productos, hacer clic en **"Corregir"** (naranja)
3. Se abre el modal **"Corregir Producto en Pedido"**
4. Arriba se muestra el producto actual (nombre, talla, cantidad, precio)
5. **Para cambiar el producto:** Usar el buscador para encontrar el nuevo producto y seleccionarlo
6. **Para cambiar solo la cantidad:** Modificar el campo "Cantidad"
7. Escribir el motivo de la correccion en "Notas de Correccion" (obligatorio)
8. Hacer clic en **"Corregir Producto"**

**Si el precio cambia y el cliente ya abono mas de lo que ahora vale el pedido:**
- El sistema crea automaticamente un egreso (devolucion de la diferencia)
- Aparece un aviso indicando cuanto hay que devolverle al cliente

---

## SITUACION A.3: ANULAR PRODUCTO EN PEDIDO (SIN FACTURAR)

**Cuando pasa:** Un producto del pedido ya no se necesita y hay que sacarlo.

### Pasos:

1. Ir a **Pedidos** > buscar el pedido > **Ver/Gestionar**
2. Hacer clic en **"Anular"** (rojo) en el producto
3. Se abre el modal **"Anular Producto"**
4. Escribir el motivo de la anulacion (obligatorio)
5. Hacer clic en **"Anular Producto"**

**Que pasa:**
- El producto se marca como ANULADO (queda visible pero tachado)
- Se libera el inventario reservado
- Se reduce el total del pedido
- Si el cliente habia abonado mas del nuevo total, se genera un egreso automatico

**NOTA:** No se puede anular el ultimo producto activo del pedido. Si necesitas cancelar todo, usa "Anular Pedido" completo.

---

## SITUACION B: CAMBIO DE PRODUCTO YA FACTURADO

**Cuando pasa:** El cliente ya recibio y pago todo (pedido facturado o compra directa en POS), pero necesita cambiar un producto por otro (otra talla, otro color, otro producto).

### Pasos:

1. Ir a **Cambios y Devoluciones** en el menu lateral
2. En el campo "Buscar Factura", escribir el **numero de factura** y presionar Enter o hacer clic en **"Buscar"**
3. Si hay facturas duplicadas, seleccionar la correcta del listado
4. Aparece la lista de productos de esa factura
5. **Marcar con el checkbox** los productos que el cliente quiere cambiar
6. Para cada producto seleccionado:
   - Ajustar la **"Cantidad a devolver"** si no devuelve todas las unidades
   - Seleccionar la **"Razon"** del cambio (ej: "Talla incorrecta")
7. Hacer clic en el boton naranja **"Registrar Cambio"**
8. Se abre el modal de cambio con dos lados:
   - **Izquierda:** Productos que se devuelven (con valores)
   - **Derecha:** Buscador para agregar los productos nuevos
9. **Buscar y agregar los productos nuevos:**
   - Escribir el nombre en el buscador
   - Seleccionar la talla si aplica
   - Hacer clic en **"Agregar"**
   - Ajustar cantidades si es necesario
10. Revisar la **diferencia** que aparece abajo:
    - **"Cliente paga"** (verde): El nuevo producto es mas caro, el cliente debe pagar la diferencia
    - **"Cliente recibe"** (rojo): El nuevo producto es mas barato, se le devuelve la diferencia
    - **"Sin diferencia"**: Mismo precio, no se mueve dinero
11. **Seleccionar el metodo de pago/devolucion** de la diferencia (si la hay)
12. Hacer clic en **"Confirmar Cambio"**
13. Se genera una tirilla/comprobante - hacer clic en **"Imprimir"** para imprimirla

### METODO DE PAGO - CUANDO USAR CADA UNO:

| Metodo | Cuando usarlo |
|--------|---------------|
| **Efectivo** | El dinero de la diferencia se paga/devuelve en efectivo |
| **Nequi** | Se paga/devuelve por Nequi |
| **Daviplata** | Se paga/devuelve por Daviplata |
| **Nu** | Se paga/devuelve por Nu |
| **Tarjeta** | Se paga/devuelve con tarjeta |
| **Cruce de saldo** | El dinero de la devolucion se usa para pagar el nuevo producto o un nuevo pedido. NO se mueve dinero fisico |

---

## SITUACION C: DEVOLUCION DE PRODUCTO YA FACTURADO

**Cuando pasa:** El cliente quiere devolver un producto y recibir su dinero de vuelta (no quiere otro producto a cambio).

### Pasos:

1. Ir a **Cambios y Devoluciones**
2. Buscar la factura por numero
3. Marcar con checkbox los productos a devolver
4. Ajustar cantidad y seleccionar razon para cada producto
5. Hacer clic en el boton rosa **"Registrar Devolucion"**
6. Se abre el modal de confirmacion:
   - Revisar los productos y montos
   - El **metodo de devolucion ya viene seleccionado** con el mismo metodo que uso el cliente para pagar (si pago en Nequi, aparece Nequi)
   - Puedes cambiarlo si es necesario
   - Agregar notas si quieres
7. Hacer clic en **"Confirmar Devolucion"**
8. Imprimir la tirilla

### CUANDO USAR "CRUCE DE SALDO":

Seleccionar **"Cruce de saldo"** cuando:
- El cliente devuelve un producto y con ese dinero va a hacer un nuevo pedido
- El cliente devuelve un producto y el dinero se abona a otro pedido existente
- En general: **cuando no se le entrega dinero fisico al cliente** porque el monto se "cruza" con otra compra

**Si usas "Efectivo" cuando en realidad fue un cruce de saldo, la caja va a quedar descuadrada** porque el sistema registra que salio dinero de la caja cuando en realidad no salio.

---

## SITUACION D: DEVOLUCION DE FACTURA + NUEVO PEDIDO (PRENDA NO EN STOCK)

**Cuando pasa:** El cliente ya tiene su factura (ya pago), pero la prenda no le queda y la nueva talla NO esta disponible en stock. Hay que mandar a hacer la prenda, entonces se necesita crear un nuevo pedido.

**IMPORTANTE:** Este es el caso que mas descuadra la caja si no se hace bien.

### Pasos:

**PASO 1 - Registrar la devolucion:**

1. Ir a **Cambios y Devoluciones**
2. Buscar la factura por numero
3. Seleccionar el producto que no le quedo
4. Seleccionar razon: **"Talla incorrecta"**
5. Hacer clic en **"Registrar Devolucion"**
6. En metodo de devolucion seleccionar **"Cruce de saldo"**
7. Confirmar la devolucion
8. Imprimir tirilla

**PASO 2 - Crear el nuevo pedido:**

1. Ir a **Pedidos**
2. Crear un nuevo pedido para el cliente con la prenda en la talla correcta
3. En la seccion de abono inicial:
   - Poner el monto que se devolvio (ej: $89,000)
   - En metodo de pago seleccionar **"Cruce de saldo"**
   - En el campo **"Factura/Pedido de origen"** que aparece, escribir: **"Factura #XXX"** (el numero de la factura original)
4. Crear el pedido

**Que pasa contablemente:**
- Devolucion: -$89,000 con metodo "Cruce de saldo" → NO afecta efectivo
- Abono nuevo pedido: +$89,000 con metodo "Cruce de saldo" → NO afecta efectivo
- Resultado: la caja queda cuadrada porque no se movio dinero fisico

**Si en vez de "Cruce de saldo" se pone "Efectivo":**
- Devolucion: -$89,000 en Efectivo → el sistema cree que salio plata
- Abono: +$89,000 en Efectivo → el sistema cree que entro plata
- Aunque se cancela matematicamente, puede generar confusion en el reporte

### Tambien aplica para:

- Devolucion de factura y abono a un **pedido existente** (ir a Pedidos > Gestionar > Registrar Abono Adicional > metodo "Cruce de saldo")
- Devolucion de factura y abono a un **apartado** (ir a Apartados > Gestionar > Registrar Abono > metodo "Cruce de saldo")

En todos estos casos: **siempre escribir el numero de factura de origen** en el campo que aparece cuando seleccionas "Cruce de saldo".

---

## RAZONES DE DEVOLUCION/CAMBIO DISPONIBLES

| Razon | Cuando usarla |
|-------|---------------|
| Talla incorrecta | La prenda le queda grande o pequena |
| Defecto de fabricacion | La prenda vino con un defecto de fabrica |
| Defecto en prenda | La prenda tiene un dano o imperfeccion |
| Preferencia del cliente | El cliente simplemente no la quiere |
| Color incorrecto | Se le entrego un color diferente al solicitado |
| Otro | Cualquier otra razon |

---

## ERRORES COMUNES Y COMO EVITARLOS

### 1. "No se puede facturar con saldo pendiente"
**Causa:** El cliente no ha pagado el total del pedido.
**Solucion:** Primero registrar el abono por el saldo pendiente, luego intentar facturar.

### 2. La caja queda descuadrada despues de una devolucion
**Causa mas comun:** Se selecciono "Efectivo" como metodo de devolucion pero en realidad el dinero se uso para otro pedido (cruce de saldo).
**Solucion:** Siempre usar **"Cruce de saldo"** cuando el dinero no sale fisicamente de la caja.

### 3. No aparece el boton "Talla" en un producto del pedido
**Causa:** El producto todavia esta "En Produccion" y no se ha marcado como listo.
**Solucion:** Primero cambiar el estado del producto a "Listo para Entrega" usando el boton "Estado" (azul).

### 4. Producto ya aparece como "Devuelto" o "Cambiado"
**Causa:** Ese producto ya fue procesado anteriormente.
**Solucion:** No se puede devolver/cambiar dos veces el mismo producto.

---

## RESUMEN RAPIDO

```
PEDIDO SIN FACTURAR + Cambio de talla       --> Pedidos > Gestionar > Boton "Talla"
PEDIDO SIN FACTURAR + Cambiar producto      --> Pedidos > Gestionar > Boton "Corregir"
PEDIDO SIN FACTURAR + Quitar producto       --> Pedidos > Gestionar > Boton "Anular"

FACTURA + Cambiar por otro (hay stock)      --> Cambios y Devoluciones > "Registrar Cambio"
FACTURA + Devolver y recibir dinero         --> Cambios y Devoluciones > "Registrar Devolucion"
FACTURA + Devolver y hacer nuevo pedido     --> Devoluciones (Cruce de saldo) + Pedidos (Cruce de saldo)

Dinero NO sale de caja (cruce)              --> Metodo: "Cruce de saldo" + escribir factura de origen
Dinero SI sale de caja                      --> Metodo: "Efectivo" / "Nequi" / etc.
```
