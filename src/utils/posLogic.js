/**
 * posLogic.js
 * Cálculos puros de facturación del Punto de Venta: subtotal, descuentos
 * (por item y general, en % o $), IVA, total y cambio.
 * Sin Firebase, sin React. 100% testable con: npm test
 *
 * Estructura esperada de un item del carrito:
 *   { product: { precio: number }, cantidad: number,
 *     descuento: number, tipoDescuento: '%' | '$' }
 */

/**
 * Subtotal = suma de precio × cantidad de cada item (antes de descuentos/IVA).
 */
export const calcularSubtotal = (cartItems = []) =>
  cartItems.reduce((sum, item) => sum + ((item.product?.precio || 0) * (item.cantidad || 0)), 0);

/**
 * Descuento de un item. Si es '%', porcentaje sobre su total; si es '$',
 * monto fijo que NUNCA excede el total del item.
 */
export const calcularDescuentoItem = (item) => {
  const itemTotal = (item.product?.precio || 0) * (item.cantidad || 0);
  if (item.tipoDescuento === '%') {
    return itemTotal * ((item.descuento || 0) / 100);
  }
  return Math.min(item.descuento || 0, itemTotal);
};

/**
 * Suma de los descuentos de todos los items.
 */
export const calcularDescuentoTotalItems = (cartItems = []) =>
  cartItems.reduce((sum, item) => sum + calcularDescuentoItem(item), 0);

/**
 * Descuento general sobre el subtotal. '%' = porcentaje; '$' = monto fijo
 * que no excede el subtotal.
 */
export const calcularDescuentoGeneral = (subtotal, descuentoGeneral = 0, tipoDescuentoGeneral = '%') => {
  if (tipoDescuentoGeneral === '%') {
    return subtotal * (descuentoGeneral / 100);
  }
  return Math.min(descuentoGeneral, subtotal);
};

/**
 * IVA sobre el subtotal DESPUÉS de descuentos (items + general).
 * Si aplicarIVA es false, retorna 0.
 */
export const calcularIVA = ({ subtotal, descuentoItems, descuentoGeneral, aplicarIVA, ivaRate = 19 }) => {
  if (!aplicarIVA) return 0;
  const base = subtotal - descuentoItems - descuentoGeneral;
  return base * (ivaRate / 100);
};

/**
 * Total final = subtotal − descuentos + IVA.
 */
export const calcularTotal = ({ subtotal, descuentoItems, descuentoGeneral, iva }) =>
  subtotal - descuentoItems - descuentoGeneral + iva;

/**
 * Cambio a devolver en pago en efectivo. Nunca negativo.
 */
export const calcularCambio = (total, montoPagado) =>
  Math.max(0, (montoPagado || 0) - total);

/**
 * Resumen completo de la venta en un solo paso (conveniencia).
 * @returns {{subtotal, descuentoItems, descuentoGeneral, iva, total}}
 */
export const calcularResumenVenta = ({ cartItems = [], descuentoGeneral = 0, tipoDescuentoGeneral = '%', aplicarIVA = false, ivaRate = 19 }) => {
  const subtotal = calcularSubtotal(cartItems);
  const descuentoItems = calcularDescuentoTotalItems(cartItems);
  const descGeneral = calcularDescuentoGeneral(subtotal, descuentoGeneral, tipoDescuentoGeneral);
  const iva = calcularIVA({ subtotal, descuentoItems, descuentoGeneral: descGeneral, aplicarIVA, ivaRate });
  const total = calcularTotal({ subtotal, descuentoItems, descuentoGeneral: descGeneral, iva });
  return { subtotal, descuentoItems, descuentoGeneral: descGeneral, iva, total };
};
