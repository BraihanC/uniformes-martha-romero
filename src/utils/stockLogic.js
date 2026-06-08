/**
 * stockLogic.js
 * Lógica pura de inventario: stock disponible y estado de items de pedido POS.
 * Sin Firebase, sin React. 100% testable con: npm test
 *
 * Extraído de cálculos que estaban duplicados en Inventory, POS, Devoluciones,
 * EntradaSatelite, EntradaProveedor y CuentasPorPagar.
 */

// ─────────────────────────────────────────────────────────────
// STOCK DISPONIBLE
// ─────────────────────────────────────────────────────────────

/**
 * Stock disponible para venta = stockTotal − reservas, con piso en 0
 * (nunca negativo). Las reservas son las 3 colas: pedidos POS, apartados y B2B.
 *
 * @param {Object} producto - doc de `products` (campos pueden faltar → 0)
 * @returns {number} unidades disponibles para vender, nunca negativo
 */
export const calcularDisponible = (producto = {}) => {
  const stockTotal = producto.stockTotal || 0;
  const reservadoPedidos = producto.stockReservadoPedidos || 0;
  const reservadoApartados = producto.stockReservadoApartados || 0;
  const reservadoB2B = producto.stockReservadoB2B || 0;
  const disponible = stockTotal - reservadoPedidos - reservadoApartados - reservadoB2B;
  return Math.max(0, disponible);
};

/**
 * ¿Hay stock disponible suficiente para vender `cantidad` unidades?
 */
export const haySuficiente = (producto, cantidad) => {
  return calcularDisponible(producto) >= (cantidad || 0);
};

// ─────────────────────────────────────────────────────────────
// ESTADO DE ITEM DE PEDIDO POS
// ─────────────────────────────────────────────────────────────

/**
 * Calcula el estado de un item de pedido POS a partir de sus cantidades.
 * Replica EXACTAMENTE la lógica que estaba duplicada en entradas y anulaciones:
 *   1. Todo entregado            → 'Entregado'
 *   2. Lista + entregada cubren  → 'Listo para Entrega'
 *   3. Algo alistado             → 'Parcialmente Listo'
 *   4. Nada                      → 'En Producción'
 *
 * El orden de las condiciones importa y se conserva tal cual el original.
 *
 * @param {Object} p
 * @param {number} p.cantidad           - cantidad total del item
 * @param {number} [p.cantidadLista]    - unidades alistadas (valor final tras la operación)
 * @param {number} [p.cantidadEntregada]- unidades ya entregadas
 * @returns {'Entregado'|'Listo para Entrega'|'Parcialmente Listo'|'En Producción'}
 */
export const calcularEstadoItemPOS = ({ cantidad, cantidadLista = 0, cantidadEntregada = 0 }) => {
  if (cantidadEntregada === cantidad) return 'Entregado';
  if (cantidadLista + cantidadEntregada === cantidad) return 'Listo para Entrega';
  if (cantidadLista > 0) return 'Parcialmente Listo';
  return 'En Producción';
};
