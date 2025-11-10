# 📊 Reporte de Utilidad - Productos Comprados

## 🎯 Objetivo

Analizar la rentabilidad de los productos que **compras ya terminados a proveedores** (medias, corbatas, moños, etc.), mostrando:
- Cuánto vendiste
- Cuánto te costó
- Cuánto ganaste
- Qué margen de utilidad obtuviste

---

## 🔍 Características del Reporte

### 1. **Filtros por Fecha**
- Fecha Inicio: Desde qué fecha quieres analizar
- Fecha Fin: Hasta qué fecha
- Botón "Limpiar Filtros": Ver todo el histórico

### 2. **Resumen General (4 Tarjetas)**

| Tarjeta | Color | Contenido |
|---------|-------|-----------|
| **Utilidad Total** | Verde | Ganancia neta total del período |
| **Ingresos Totales** | Azul | Total vendido (sin descuentos) |
| **Margen Promedio** | Morado | Porcentaje de ganancia promedio |
| **Unidades Vendidas** | Naranja | Cantidad total de productos vendidos |

### 3. **Tabla Detallada por Producto**

Columnas:
- **Producto**: Nombre, referencia y talla
- **Unidades Vendidas**: Cantidad total vendida
- **Costo Compra**: Costo unitario configurado en Gestión de Costos
- **Costo Total**: Costo × Cantidad vendida
- **Ingresos Totales**: Precio de venta × Cantidad vendida
- **Utilidad Total**: Ingresos - Costos
- **Margen %**: (Utilidad / Costo) × 100

### 4. **Indicadores Visuales de Margen**

| Color | Rango | Interpretación |
|-------|-------|----------------|
| 🟢 Verde | ≥ 50% | Excelente margen |
| 🟡 Amarillo | 30-49% | Buen margen |
| 🔴 Rojo | < 30% | Margen bajo |

---

## 📐 Fórmulas Utilizadas

### Utilidad Unitaria
```
Utilidad Unitaria = Precio de Venta - Costo de Compra
```

### Utilidad Total por Producto
```
Utilidad Total = (Precio de Venta - Costo de Compra) × Cantidad Vendida
```

### Margen de Utilidad (%)
```
Margen % = ((Precio de Venta - Costo de Compra) / Costo de Compra) × 100
```

### Ejemplo Práctico

**Producto**: Medias Escolares
- **Costo de Compra**: $8,000 (configurado en Gestión de Costos)
- **Precio de Venta**: $12,000
- **Unidades Vendidas**: 50

**Cálculos**:
```
Utilidad Unitaria = $12,000 - $8,000 = $4,000
Utilidad Total = $4,000 × 50 = $200,000
Margen % = ($4,000 / $8,000) × 100 = 50%
```

**Resultado**:
- Costo Total: $400,000
- Ingresos Totales: $600,000
- Utilidad Total: $200,000
- Margen: 50% (🟢 Excelente)

---

## 🔗 Conexión con el Sistema

### Origen de Datos

1. **Costos de Compra** (`products.costoCompra`)
   - Configurados en: **Configuración → Gestión de Costos**
   - Excel: `REFERENCIA | COSTO_COMPRA | COSTO_SATELITE`
   - Solo productos con `costoCompra > 0` aparecen en el reporte

2. **Ventas** (`sales` collection)
   - Registradas desde: **POS (Punto de Venta)**
   - Contienen: `items[]` con `productoId`, `cantidad`, `precioUnitario`

3. **Productos** (`products` collection)
   - Información base: `nombre`, `referencia`, `talla`, `costoCompra`

### Flujo de Datos

```
┌─────────────────────────────────────┐
│  CONFIGURACIÓN (Admin)              │
│  Gestión de Costos                  │
│  ├─ Carga Excel con costos         │
│  └─ Actualiza products.costoCompra │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  VENTAS (POS)                       │
│  ├─ Cliente compra producto        │
│  ├─ Precio: $12,000                │
│  └─ Guarda en sales.items[]        │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  REPORTE UTILIDAD                   │
│  1. Lee todas las ventas           │
│  2. Para cada item vendido:        │
│     ├─ Obtiene costoCompra del     │
│     │   producto                    │
│     ├─ Calcula utilidad:           │
│     │   precio - costoCompra        │
│     └─ Calcula margen %            │
│  3. Agrupa por producto            │
│  4. Suma totales                   │
└─────────────────────────────────────┘
```

---

## 🎨 Interfaz de Usuario

### Estructura Visual

```
┌─────────────────────────────────────────────┐
│  Reporte de Utilidad - Productos Comprados │
│  Análisis de rentabilidad                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  📅 FILTROS                                │
│  ┌────────┐ ┌────────┐ ┌──────────────┐   │
│  │ Inicio │ │  Fin   │ │ Limpiar Filtros│   │
│  └────────┘ └────────┘ └──────────────┘   │
└─────────────────────────────────────────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ UTILIDAD │ │ INGRESOS │ │  MARGEN  │ │ UNIDADES │
│  TOTAL   │ │  TOTALES │ │ PROMEDIO │ │ VENDIDAS │
│ $200,000 │ │ $600,000 │ │   50%    │ │    50    │
│  🟢      │ │  🔵      │ │  🟣      │ │   🟠     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

┌─────────────────────────────────────────────┐
│  📊 TABLA DE PRODUCTOS                     │
│  ┌───────┬──────┬──────┬──────┬──────┬─────┐│
│  │Product│Unid. │Costo │Ingr. │Util. │Marg.││
│  ├───────┼──────┼──────┼──────┼──────┼─────┤│
│  │Medias │  50  │$400K │$600K │$200K │ 50% ││
│  │Corbata│  30  │$150K │$300K │$150K │100% ││
│  └───────┴──────┴──────┴──────┴──────┴─────┘│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  📖 LEYENDA DE MÁRGENES                    │
│  🟢 ≥50% Excelente  🟡 30-49% Bueno  🔴 <30%│
└─────────────────────────────────────────────┘
```

---

## 🚀 Casos de Uso

### Caso 1: Análisis Mensual
**Objetivo**: Ver la utilidad del mes de Octubre

**Pasos**:
1. Ir a **Reportes → Utilidad Productos**
2. Filtro Inicio: `2025-10-01`
3. Filtro Fin: `2025-10-31`
4. Ver totales y productos más rentables

**Resultado**: Identificas qué productos te dejaron más ganancia

---

### Caso 2: Comparación de Períodos
**Objetivo**: Comparar Q1 vs Q2

**Para Q1 (Ene-Mar)**:
1. Fecha Inicio: `2025-01-01`
2. Fecha Fin: `2025-03-31`
3. Anotar: Utilidad Total = $X

**Para Q2 (Abr-Jun)**:
1. Fecha Inicio: `2025-04-01`
2. Fecha Fin: `2025-06-30`
3. Comparar: Utilidad Total = $Y

**Análisis**: Determinar si la rentabilidad creció o disminuyó

---

### Caso 3: Evaluación de Productos
**Objetivo**: Identificar productos de bajo margen

**Pasos**:
1. Ver reporte completo (sin filtros)
2. Ordenar tabla por "Margen %"
3. Identificar productos en 🔴 Rojo (< 30%)
4. Decisión:
   - ¿Aumentar precio de venta?
   - ¿Negociar mejor costo con proveedor?
   - ¿Dejar de vender ese producto?

---

### Caso 4: Productos Más Rentables
**Objetivo**: Identificar qué productos impulsar en ventas

**Pasos**:
1. Ver reporte completo
2. Ordenar por "Utilidad Total" (ya viene así por defecto)
3. Top 5 productos = Mayor ganancia
4. Estrategia:
   - Asegurar stock siempre disponible
   - Promocionar estos productos
   - Ubicarlos en lugar visible

---

## 📊 Métricas Clave a Monitorear

### 1. **Margen Promedio**
- **Objetivo Recomendado**: ≥ 40%
- **Acción si < 30%**: Revisar estrategia de precios

### 2. **Productos con Margen Bajo**
- **Indicador**: 🔴 Rojo en tabla
- **Acción**: Analizar si vale la pena mantenerlos

### 3. **Utilidad Total vs Ingresos**
- **Ratio Saludable**: Utilidad ≥ 35% de Ingresos
- **Ejemplo**: Si vendes $1,000,000, utilidad debería ser ≥ $350,000

### 4. **Productos de Alto Volumen, Bajo Margen**
- **Patrón**: Vende mucho (🔢 alto) pero margen bajo (🔴)
- **Decisión**: ¿Compensan el volumen con ganancia total?

---

## ⚠️ Limitaciones y Consideraciones

### 1. **Solo Productos Comprados**
- ❌ NO incluye productos fabricados (satélites)
- ✅ Solo productos con `costoCompra > 0`

### 2. **Costos Fijos No Incluidos**
El reporte **NO** considera:
- Arriendo del local
- Servicios (luz, agua, internet)
- Salarios
- Otros gastos operativos

**Utilidad Real** = `Utilidad del Reporte` - `Costos Fijos`

### 3. **Descuentos Aplicados**
Los descuentos se restan del precio de venta:
- `precioUnitario` en la tabla ya incluye descuentos
- Utilidad se calcula sobre precio final vendido

### 4. **Fechas de Creación**
El filtro usa `createdAt` de las ventas (fecha de venta), no fecha de entrega

---

## 🔐 Seguridad y Permisos

### Acceso al Reporte
- **Visible para**: Solo **Administradores**
- **Ubicación**: Reportes → Utilidad Productos
- **Ruta**: `/reportes/utilidad`

### Protección de Datos
- Personal de bodega **NO** ve este reporte
- Costos solo visibles para admin
- Información financiera confidencial

---

## 📝 Interpretación de Resultados

### Ejemplo de Análisis Completo

**Datos del Reporte**:
```
Utilidad Total: $5,000,000
Ingresos Totales: $15,000,000
Margen Promedio: 45%
Unidades Vendidas: 1,200
```

**Interpretación**:
1. **Rentabilidad Global**: Por cada $100 que vendes, ganas $45
2. **Margen Saludable**: 45% está por encima del 40% recomendado
3. **Costo de Mercancía**: Gastaste $10,000,000 en comprar productos
4. **Rotación**: Vendiste 1,200 unidades en el período

**Top 3 Productos**:
```
1. Corbatas: Margen 100% (🟢) - Priorizar stock
2. Medias: Margen 50% (🟢) - Mantener disponibilidad
3. Cinturones: Margen 25% (🔴) - Evaluar rentabilidad
```

**Acciones Recomendadas**:
- ✅ Aumentar stock de Corbatas y Medias
- ⚠️ Subir precio de Cinturones o buscar proveedor más económico
- 📊 Monitorear semanalmente para detectar tendencias

---

## 🚀 Acceso al Reporte

### URL Directa
```
http://localhost:5174/reportes/utilidad
```

### Navegación
1. Login como **Admin**
2. Menú: **Reportes**
3. Pestaña: **Utilidad Productos**

---

## 📅 Recomendaciones de Uso

### Frecuencia de Revisión
- **Diaria**: No necesario
- **Semanal**: Recomendado para negocio activo
- **Mensual**: Mínimo recomendado
- **Trimestral**: Para análisis de tendencias

### Mejores Prácticas
1. **Comparar períodos iguales**: Mes vs Mes, no Mes vs Semana
2. **Considerar temporadas**: Ventas de útiles vs otras épocas
3. **Actualizar costos regularmente**: Si proveedores cambian precios
4. **Documentar decisiones**: Anotar por qué cambias precios

---

**Fecha de Creación**: 09/11/2025
**Archivo**: src/components/reportes/ReporteUtilidad.jsx
**Estado**: ✅ FUNCIONANDO
