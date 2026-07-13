/**
 * devolucionesLogic.js
 * Cálculos puros de devoluciones y cambios: valor devuelto, valor de productos
 * nuevos y diferencia a cobrar/devolver. Sin Firebase, sin React.
 * 100% testable con: npm test
 */

/**
 * Valor total de los items devueltos.
 * Recorre los índices seleccionados sobre el array de items de la factura,
 * usando la cantidad devuelta indicada (o la cantidad original si no se indicó).
 * Precio con fallback legacy: precioUnitario || precio || 0.
 *
 * @param {Array}  items      - facturaEncontrada.items
 * @param {Array<number>} indicesSeleccionados
 * @param {Object} cantidadesDevueltas - mapa { [index]: cantidad }
 * @returns {number}
 */
export const calcularValorDevuelto = (items = [], indicesSeleccionados = [], cantidadesDevueltas = {}) => {
  return indicesSeleccionados.reduce((total, index) => {
    const item = items[index];
    if (!item) return total;
    const cantidadDevuelta = cantidadesDevueltas[index] || item.cantidad;
    return total + (cantidadDevuelta * (item.precioUnitario || item.precio || 0));
  }, 0);
};

/**
 * Valor total de los productos nuevos (en un cambio).
 * @param {Array} productosNuevos - cada uno { cantidad, precio }
 */
export const calcularValorProductosNuevos = (productosNuevos = []) =>
  productosNuevos.reduce((total, p) => total + ((p.cantidad || 0) * (p.precio || 0)), 0);

/**
 * Diferencia de un cambio: positivo = el cliente paga; negativo = se le devuelve.
 */
export const calcularDiferenciaCambio = (valorNuevo, valorDevuelto) =>
  valorNuevo - valorDevuelto;

/**
 * Unidades ya devueltas/cambiadas de un item (acumulado histórico).
 * Legacy: items procesados antes del contador `cantidadDevuelta` solo tienen
 * el flag `estadoDevolucion` → se asumen totalmente devueltos.
 *
 * @param {Object} item - item de sales
 * @returns {number}
 */
export const cantidadYaDevuelta = (item = {}) => {
  if (item.cantidadDevuelta !== undefined && item.cantidadDevuelta !== null) {
    return item.cantidadDevuelta;
  }
  return item.estadoDevolucion ? (item.cantidad || 0) : 0;
};

/**
 * Unidades de un item que AÚN se pueden devolver/cambiar.
 * Un item anulado (línea ya revertida en BuscadorFacturas) no admite devolución.
 *
 * @param {Object} item - item de sales
 * @returns {number} nunca negativo
 */
export const cantidadDisponibleDevolver = (item = {}) => {
  if (item.anulado) return 0;
  return Math.max(0, (item.cantidad || 0) - cantidadYaDevuelta(item));
};
