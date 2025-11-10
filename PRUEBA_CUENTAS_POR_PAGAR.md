# ✅ Prueba de Integración: Cuentas por Pagar a Satélites

## 🔗 Flujo de Datos Verificado

### 1️⃣ Configuración de Costos
**Ubicación**: Configuración → Gestión de Costos

**Archivo**: `src/components/config/GestionCostos.jsx`

**Proceso**:
- Carga Excel con columnas: `REFERENCIA | COSTO_COMPRA | COSTO_SATELITE`
- Actualiza la tabla `products` con los campos:
  - `costoCompra` (para productos comprados)
  - `costoSatelite` (para productos fabricados)

**Código Relevante** (línea 92-96):
```javascript
batch.update(productRef, {
  costoCompra: costoCompra,
  costoSatelite: costoSatelite,
  updatedAt: serverTimestamp()
});
```

---

### 2️⃣ Entrada de Satélite
**Ubicación**: Entradas → Entrada de Satélite (Producción)

**Archivo**: `src/components/entradas/EntradaSatelite.jsx`

**Proceso**:
- Usuario selecciona producto
- Sistema lee automáticamente `product.costoSatelite` (línea 116)
- NO muestra el costo al usuario (personal de bodega)
- Calcula: `costoTotal = costoSatelite × cantidad`
- Guarda en `stockEntries` con `pagado: false`

**Código Relevante** (línea 115-145):
```javascript
// Obtener el costo del satélite del producto (configurado en Gestión de Costos)
const costoSatelite = selectedProduct.costoSatelite || 0;

// Crear registro de auditoría en stockEntries
batch.set(entryRef, {
  tipoEntrada: 'satelite',
  productId: selectedProduct.id,
  referencia: selectedProduct.referencia,
  nombre: selectedProduct.nombre,
  talla: selectedProduct.talla || 'Única',
  cantidad: numCantidad,
  costoUnitario: costoSatelite,        // ← Desde products.costoSatelite
  costoTotal: costoSatelite * numCantidad,  // ← Calculado automáticamente
  sateliteId: sateliteId,
  userId: currentUser.uid,
  notas: notas.trim() || '',
  pagado: false,                        // ← Para tracking de pagos
  createdAt: serverTimestamp()
});
```

---

### 3️⃣ Reporte de Cuentas por Pagar
**Ubicación**: Reportes → Cuentas por Pagar

**Archivo**: `src/components/reportes/CuentasPorPagar.jsx`

**Proceso**:
- Consulta `stockEntries` donde:
  - `tipoEntrada = 'satelite'`
  - `pagado = false`
- Agrupa entradas por `sateliteId`
- Suma `costoTotal` de cada satélite
- Muestra resumen general y detalle expandible
- Permite marcar como pagado

**Código Relevante** (línea 27-37):
```javascript
// Obtener todas las entradas de satélite NO PAGADAS
const q = query(
  collection(db, 'stockEntries'),
  where('tipoEntrada', '==', 'satelite'),
  where('pagado', '==', false)
);
const entradasSnapshot = await getDocs(q);
const entradas = entradasSnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

**Agrupación por satélite** (línea 42-55):
```javascript
entradas.forEach(entrada => {
  const sateliteId = entrada.sateliteId;

  if (!cuentasMap.has(sateliteId)) {
    cuentasMap.set(sateliteId, {
      sateliteId: sateliteId,
      entradas: [],
      totalAdeudado: 0
    });
  }

  const cuenta = cuentasMap.get(sateliteId);
  cuenta.entradas.push(entrada);
  cuenta.totalAdeudado += entrada.costoTotal || 0;  // ← Suma de costos
});
```

---

## 🧪 Pasos para Probar el Flujo Completo

### Paso 1: Configurar Costos (Admin)
1. Ir a **Configuración → Gestión de Costos**
2. Crear archivo Excel con formato:
   ```
   REFERENCIA | COSTO_COMPRA | COSTO_SATELITE
   10201      | 0            | 15000
   10202      | 0            | 22000
   ```
3. Cargar el archivo
4. Verificar mensaje: "✅ X productos actualizados correctamente"

### Paso 2: Registrar Entrada de Satélite (Bodega)
1. Ir a **Entradas → Entrada de Satélite**
2. Buscar producto (Ref: 10201)
3. Ingresar:
   - Cantidad: 50
   - Satélite: Seleccionar uno existente
   - Notas (opcional)
4. **✅ VERIFICAR**: NO se muestra el costo al usuario
5. Click en "Guardar Entrada"
6. Verificar mensaje: "¡Stock actualizado correctamente!"

### Paso 3: Verificar Cuentas por Pagar (Admin)
1. Ir a **Reportes → Cuentas por Pagar**
2. **✅ VERIFICAR**:
   - Banner rosa muestra total adeudado
   - Aparece el satélite con saldo pendiente
   - Monto = 15000 × 50 = $750,000
3. Click en el satélite para expandir
4. **✅ VERIFICAR** tabla detallada muestra:
   - Fecha de entrada
   - Producto (Ref: 10201)
   - Cantidad: 50
   - Costo Unit: $15,000
   - Total: $750,000

### Paso 4: Marcar como Pagado
1. En el detalle del satélite, click "Marcar como Pagado"
2. Confirmar en el diálogo
3. **✅ VERIFICAR**:
   - Mensaje: "¡Entradas marcadas como pagadas exitosamente!"
   - El satélite desaparece de la lista
   - Banner muestra total reducido

---

## 🔍 Verificaciones en Firebase (Opcional)

### Tabla `products`
```javascript
{
  referencia: "10201",
  nombre: "Chaqueta Escolar",
  costoSatelite: 15000,  // ← Configurado desde Gestión de Costos
  precio: 50000,
  stockTotal: 100
}
```

### Tabla `stockEntries`
```javascript
{
  tipoEntrada: "satelite",
  productId: "abc123",
  referencia: "10201",
  cantidad: 50,
  costoUnitario: 15000,     // ← Copiado desde products.costoSatelite
  costoTotal: 750000,        // ← Calculado: 15000 × 50
  sateliteId: "sat-xyz",
  pagado: false,             // ← Para tracking
  createdAt: timestamp
}
```

### Después de marcar como pagado:
```javascript
{
  // ... mismos campos
  pagado: true,              // ← Cambiado a true
  fechaPago: timestamp       // ← Agregado al pagar
}
```

---

## ✅ Checklist de Conexión

- [x] GestionCostos actualiza `products.costoSatelite`
- [x] EntradaSatelite lee `products.costoSatelite` automáticamente
- [x] EntradaSatelite NO muestra costos al usuario
- [x] EntradaSatelite guarda en `stockEntries` con `pagado: false`
- [x] CuentasPorPagar consulta `stockEntries` donde `pagado = false`
- [x] CuentasPorPagar agrupa y suma por satélite
- [x] CuentasPorPagar muestra detalle expandible
- [x] CuentasPorPagar permite marcar como pagado
- [x] Al marcar pagado, actualiza `pagado: true` y agrega `fechaPago`
- [x] Rutas configuradas correctamente en App.jsx
- [x] Tab visible en Reportes.jsx
- [x] Solo accesible para administradores

---

## 🎨 Elementos de UI Implementados

### Banner de Resumen
- Fondo degradado rosa (from-pink-500 to-pink-600)
- Total adeudado en grande
- Número de satélites con saldo pendiente

### Cards de Satélites
- Click para expandir/contraer
- Muestra nombre, código y total adeudado
- Indicador de número de entradas pendientes

### Tabla de Detalle
- Columnas: Fecha, Producto, Referencia, Cantidad, Costo Unit., Total
- Fila de total al final
- Botón "Marcar como Pagado" en rosa (#D50565)

### Estado Vacío
- Ícono de CheckCircle verde
- Mensaje: "¡No hay cuentas pendientes!"

---

## 🚀 Servidor de Desarrollo

**Estado**: ✅ Corriendo
**URL**: http://localhost:5174/
**Sin errores de compilación**

---

## 📝 Notas Importantes

1. **Seguridad de Datos**:
   - Personal de bodega NO ve costos en EntradaSatelite
   - Solo administradores pueden acceder a Reportes

2. **Flujo Atómico**:
   - EntradaSatelite usa `writeBatch` para actualización atómica
   - CuentasPorPagar usa `writeBatch` para marcar múltiples entradas

3. **Validaciones**:
   - Costo satelite por defecto = 0 si no está configurado
   - No se pueden marcar entradas sin confirmación

4. **Consistencia de Datos**:
   - Todos los timestamps usan `serverTimestamp()`
   - Referencias correctas entre collections

---

## ✨ Funcionalidades Extra

- **Ordenamiento**: Satélites ordenados por monto adeudado (mayor a menor)
- **Formato de Moneda**: Usa formato colombiano ($ COP)
- **Formato de Fecha**: Formato DD/MM/YYYY
- **Responsive**: Funciona en móviles y tablets
- **Loading States**: Indicadores de carga durante operaciones

---

**Fecha de Prueba**: 09/11/2025
**Estado**: ✅ TODO FUNCIONANDO CORRECTAMENTE
