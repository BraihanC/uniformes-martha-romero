# Instrucciones - Script de Investigación de Descuadre de Inventario

## Propósito
Este script investiga descuadres en el `stockReservadoPedidos` de la CAMISETA MA DEP TALLA 16, analizando todos los pedidos que contienen este producto y calculando cuánto debería estar reservado según la lógica del negocio.

## Requisitos Previos

1. **Archivo de Credenciales de Firebase**
   - Debes tener un archivo `serviceAccountKey.json` en la raíz del proyecto
   - Si no lo tienes, descárgalo desde Firebase Console:
     1. Ve a Firebase Console (https://console.firebase.google.com)
     2. Selecciona tu proyecto
     3. Ve a Configuración del Proyecto > Cuentas de Servicio
     4. Click en "Generar nueva clave privada"
     5. Guarda el archivo como `serviceAccountKey.json` en la raíz del proyecto

2. **Dependencias de Node.js**
   - El script usa `firebase-admin` que ya está instalado en el proyecto
   - Si hay algún problema, ejecuta: `npm install firebase-admin`

## Cómo Usar el Script

1. **Asegúrate de tener el archivo de credenciales**
   ```bash
   # Verifica que existe el archivo
   ls serviceAccountKey.json
   ```

2. **Ejecuta el script**
   ```bash
   node investigar-descuadre.js
   ```

3. **Revisa la salida**
   - El script mostrará cada pedido encontrado con el producto
   - Para cada pedido verás:
     - Número de pedido
     - Cliente y teléfono
     - Estado del pedido
     - Detalles del item (cantidad, cantidadLista, cantidadEntregada, etc.)
     - Cuánto DEBERÍA reservar según el estado

## Lógica de Reserva del Inventario

El script calcula cuánto inventario DEBERÍA estar reservado según estas reglas:

- **"En Producción"** → Reserva 0 (no reserva hasta que esté listo)
- **"Parcialmente Listo"** → Reserva `cantidadLista` (solo lo que está listo)
- **"Listo para Entrega"** → Reserva `cantidad` (cantidad total)
- **"Entregado"** → Reserva 0 (ya fue entregado)
- **Anulado** → Reserva 0 (no reserva nada)

## Interpretación de Resultados

Al final del script verás:

```
============================================================
RESUMEN DEL ANÁLISIS
============================================================
Total de pedidos encontrados: X
Total stockReservadoPedidos calculado: Y unidades

============================================================
VERIFICANDO PRODUCTO EN INVENTARIO
============================================================
Stock Reservado ACTUAL: Z
Stock Reservado CALCULADO: Y
Diferencia: (Z - Y)
```

Si hay diferencia:
- **Positiva** → El inventario está reservando MÁS de lo que debería
- **Negativa** → El inventario está reservando MENOS de lo que debería
- **Cero** → Todo está correcto

## Modificar el Producto a Investigar

Si quieres investigar otro producto, edita estas líneas en el script:

```javascript
const REFERENCIA = 'MA';  // Cambia la referencia del colegio
const TALLA = '16';       // Cambia la talla
```

## Solución de Problemas

### Error: "No se encontró serviceAccountKey.json"
- Descarga el archivo de credenciales desde Firebase Console (ver requisitos previos)

### Error: "Cannot find module 'firebase-admin'"
- Ejecuta: `npm install firebase-admin`

### El script se ejecuta pero no encuentra el producto
- Verifica que la referencia y talla sean correctas
- El script busca productos que empiecen con la referencia (ej: "MA" coincide con "MA003TD")

## Notas Importantes

- Este script es de SOLO LECTURA, no modifica ningún dato en Firebase
- Puede tardar varios segundos si hay muchos pedidos
- La conexión a Firebase se cierra automáticamente al finalizar
