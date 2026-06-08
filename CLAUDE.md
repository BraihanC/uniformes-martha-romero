# Uniformes Martha Romero — Contexto del proyecto

Sistema de inventario + POS para una empresa colombiana de confección y venta de
uniformes colegiales. Temporada alta: diciembre–abril. Idioma del producto: español.

## Stack

- **Frontend:** React + Vite. UI con Tailwind. Iconos `lucide-react`. PDF `jspdf`, Excel `xlsx`.
- **Backend:** Firebase — Firestore (datos), Auth (custom claims para roles), Cloud Functions (`functions/`), Storage (logo).
- **Tests:** Vitest. Lógica pura testeada en `src/utils/*.test.js`.
- **Hosting:** el build estático (`dist/`) se sube a Hostinger (`app.martharomero.co`). Proyecto Firebase: `pos-martha-romero`.

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # genera dist/ (subir a Hostinger)
npm test             # vitest run (test suite completo)
npm run lint         # eslint
firebase deploy --only firestore:rules,storage    # desplegar reglas
firebase deploy --only firestore:indexes           # desplegar índices
```

Las **reglas y los índices de Firestore viven en disco** (`firestore.rules`,
`firestore.indexes.json`, `storage.rules`) y **no surten efecto hasta hacer `firebase deploy`**.
Subir el `dist/` a Hostinger NO despliega reglas/índices — son pasos separados.

## Modelo de roles (Auth custom claims)

- Roles: **`admin`** y **`vendedor`**. Se leen de `request.auth.token.role` (custom claim), NO de Firestore.
- En frontend: `useAuth()` → `isAdmin`, `isVendedor`. El fallback de rol es `'vendedor'` (el menos privilegiado — fail-safe).
- Clientes B2B se autentican pero NO tienen rol staff; solo acceden al portal (`src/portal/`).
- `PrivateRoute` con `requireAdmin` protege rutas admin-only. Sin esa prop = cualquier staff.
- **El control de acceso en frontend es de presentación.** La protección real son las reglas de Firestore.

### Qué ve cada rol (resumen actual)
- **vendedor**: POS, Pedidos, Pedidos B2B, Apartados, Devoluciones, Clientes, Entradas, Cierre de Caja (completo), Cuentas por Pagar (marcar pagado + anular), Inventario (editar stock + crear producto, NO precios al editar), Reporte de Ventas (cantidades, SIN pesos), Configuración (SOLO pestaña Satélites: crear/editar).
- **admin**: todo, incluyendo reportes financieros (Ingresos, Utilidad, Análisis B2B), Gestión de Costos/Usuarios/Clientes B2B, y las cifras en pesos de todos los reportes.

## Modelo de stock (lo más crítico y propenso a bugs)

Cada producto en `products` tiene:
- `stockTotal` — unidades físicas en bodega.
- `stockReservadoPedidos` — reservado para pedidos POS listos.
- `stockReservadoApartados` — reservado para apartados activos.
- `stockReservadoB2B` — reservado para pedidos B2B alistados.
- `stockDefectuoso` — defectuosos (campo poco usado).
- `totalPrendasPedidas` — unidades en producción (pedidos POS).

**Disponible = stockTotal − reservadoPedidos − reservadoApartados − reservadoB2B.**

Regla de oro: **cada `increment(+X)` de una reserva debe tener su `increment(-X)` simétrico**
en los flujos de anulación/cancelación/completado. Los descuadres vienen de asimetrías.
La función admin "Recalcular Inventario" (Inventory.jsx) recomputa reservas desde cero.

## Colecciones de Firestore

`products`, `colegios`, `precios_corporativos`, `clientes_corporativos`, `clientes`, `clients`,
`pedidos` (POS), `pedidos_b2b` (portal), `apartados`, `sales` (facturas), `transactions` (caja/finanzas),
`stockEntries` (entradas satélite/proveedor), `satelites`, `proveedores`, `productosReparacion`,
`cambiosYDevoluciones`, `bases_caja`, `counters`, `notificaciones_admin`, `notificaciones_portal`,
`reportes_imperfectos`, `config`.

Reglas: casi todo es `read, write: if isStaff()`. Catálogo (`products`/`colegios`/`precios_corporativos`)
es `read: if isSignedIn()` (para el portal). `pedidos_b2b` y `reportes_imperfectos` permiten al cliente
B2B leer los suyos por `clienteEmail == request.auth.token.email`. Default deny para colecciones no listadas.

## Lógica de negocio compartida

- **`src/utils/pedidosB2BLogic.js`** — ÚNICA fuente de verdad para alistamiento/pendientes/matching B2B:
  `getAlistadaActual`, `calcularMaxAlistar`, `calcularPendientes`, `productoB2BCoincideConInventario`,
  `productoB2BCoincideConAsignacion`, etc. Tiene tests (`pedidosB2BLogic.test.js`). **No dupliques esta
  lógica** — EntradaSatelite, EntradaProveedor, Inventory, CuentasPorPagar y PedidosB2B la importan.
- **`src/utils/pedidosLogic.js`** — lógica de pedidos POS (con tests).

## Anti-patrones / bugs recurrentes en este repo

1. **`estado` vs `estadoGeneral`**: pedidos POS y apartados usan `estadoGeneral` (no `estado`).
   Solo `pedidos_b2b` usa `estado`. Confundirlos hace que filtros de "anulado/cancelado" no disparen.
2. **Campos undefined en Firestore**: Firestore rechaza `undefined`. Usar `|| 0`, `|| ''`, o limpiar
   las claves undefined antes de escribir.
3. **Precios legacy**: hay docs viejos con `precio` en vez de `precioUnitario`/`precioVenta`. Usar fallback
   en cadena: `precioVenta || precioUnitario || precio || 0`.
4. **Lost-update**: editar un doc leyendo en memoria y sobrescribir pisa cambios concurrentes (POS/satélite).
   Patrón de defensa: optimistic concurrency comparando `updatedAt` antes del commit (ver Inventory/BuscadorFacturas).
5. **Race en consecutivos**: `numeroFactura`/`numeroApartado` deben generarse con `runTransaction` sobre
   `counters/*`, no con "leer max + 1".
6. **Queries vs reglas**: si una regla restringe por un campo (ej. `clienteEmail`), la query DEBE filtrar
   por ese mismo campo o Firestore la rechaza completa con "insufficient permissions".
7. **Índices compuestos**: cualquier `where(campo) + orderBy(otro)` o dos `where` de rango necesita índice
   compuesto en `firestore.indexes.json` + deploy. Síntoma: "The query requires an index".

## Flujo de despliegue

1. `npm test` y `npm run build` deben pasar.
2. Subir `dist/` a Hostinger (frontend). Hard refresh (`Cmd+Shift+R`) por el service worker (PWA).
3. Si cambiaron reglas: `firebase deploy --only firestore:rules,storage`.
4. Si cambiaron índices: `firebase deploy --only firestore:indexes` (esperar a que compilen).
5. Cambios de rol requieren que el usuario cierre sesión y vuelva a entrar (refresca el token/claims).
