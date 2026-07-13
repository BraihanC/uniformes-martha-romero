/**
 * pedidosLogic.js
 * Lógica pura de cálculo para entregas, abonos y saldos de pedidos.
 * Estas funciones NO tienen efectos secundarios ni dependencias externas
 * (sin Firebase, sin React, sin I/O), lo que las hace 100% testables.
 *
 * Si se modifica la lógica en Pedidos.jsx, actualizar aquí también
 * y ejecutar: npm test
 */

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Un ítem se considera "inactivo" si está anulado o es un cambio de talla.
 * Los ítems inactivos se ignoran en todos los cálculos de estado y entrega.
 */
export const esItemInactivo = (item) =>
  item.anulado || item.estadoItem === 'Cambio de Talla';

// ─────────────────────────────────────────────────────────────
// CÁLCULOS DE VALOR
// ─────────────────────────────────────────────────────────────

/**
 * Calcula el valor monetario de los ítems seleccionados para entregar HOY.
 *
 * @param {Array}  items           - Array completo de ítems del pedido
 * @param {Array}  selectedIndices - Índices de los ítems seleccionados para entrega
 * @returns {number}
 */
export const calcularValorDeEntrega = (items, selectedIndices) =>
  selectedIndices.reduce((sum, index) => {
    const item = items[index];
    if (!item) return sum;

    const precioUnit = item.precio || item.precioUnitario || 0;
    const esParcial = item.estadoItem === 'Parcialmente Listo';

    if (esParcial) {
      const cantidadLista = item.cantidadLista || 0;
      return sum + (cantidadLista * precioUnit);
    } else {
      const cantidadPendiente = item.cantidad - (item.cantidadEntregada || 0);
      return sum + (cantidadPendiente * precioUnit);
    }
  }, 0);

/**
 * Calcula el valor de TODAS las unidades ya entregadas en operaciones ANTERIORES.
 * Incluye entregas previas de items seleccionados (ej: un item con entrega parcial
 * que se selecciona para entregar el resto).
 *
 * @param {Array}  items           - Array completo de ítems del pedido
 * @param {Array}  selectedIndices - Índices de los ítems seleccionados para entrega hoy
 * @returns {number}
 */
export const calcularValorYaEntregado = (items, selectedIndices) =>
  items.reduce((sum, item, index) => {
    if (item.anulado) return sum;
    const cantidadEntregada = item.cantidadEntregada || 0;
    if (cantidadEntregada > 0) {
      return sum + (cantidadEntregada * (item.precio || item.precioUnitario || 0));
    }
    return sum;
  }, 0);

/**
 * Calcula el acumulado total de valor entregado (anterior + hoy),
 * capeado al total del pedido para evitar sobreconteos por datos inconsistentes.
 *
 * @param {number} valorYaEntregado - Valor entregado en sesiones anteriores
 * @param {number} valorDeEntrega   - Valor que se entrega hoy
 * @param {number} totalPedido      - Precio total del pedido
 * @returns {number}
 */
export const calcularValorAcumuladoConHoy = (valorYaEntregado, valorDeEntrega, totalPedido) =>
  Math.min(valorYaEntregado + valorDeEntrega, totalPedido);

/**
 * Calcula cuánto debe pagar el cliente para poder llevarse los productos de hoy.
 * Retorna 0 si ya tiene pagado suficiente.
 *
 * @param {number} valorAcumuladoConHoy - Acumulado total entregado (incluyendo hoy)
 * @param {number} totalAbonado         - Total pagado por el cliente hasta ahora
 * @returns {number}
 */
export const calcularSaldoRequerido = (valorAcumuladoConHoy, totalAbonado) =>
  Math.max(0, valorAcumuladoConHoy - totalAbonado);

// ─────────────────────────────────────────────────────────────
// ACTUALIZACIÓN DE ÍTEMS
// ─────────────────────────────────────────────────────────────

/**
 * Genera el array de ítems actualizado después de registrar una entrega.
 * Los ítems seleccionados se marcan como entregados (total o parcialmente).
 *
 * @param {Array} items           - Array original de ítems
 * @param {Array} selectedIndices - Índices a entregar
 * @returns {Array} Nuevo array de ítems
 */
export const calcularUpdatedItems = (items, selectedIndices) =>
  items.map((item, index) => {
    if (!selectedIndices.includes(index)) return item;

    const esParcial = item.estadoItem === 'Parcialmente Listo';

    if (esParcial) {
      const cantidadLista = item.cantidadLista || 0;
      const nuevaCantidadEntregada = (item.cantidadEntregada || 0) + cantidadLista;
      const nuevoEstado = nuevaCantidadEntregada === item.cantidad ? 'Entregado' : 'En Producción';
      return { ...item, cantidadEntregada: nuevaCantidadEntregada, cantidadLista: 0, estadoItem: nuevoEstado };
    } else {
      return { ...item, cantidadEntregada: item.cantidad, cantidadLista: 0, estadoItem: 'Entregado' };
    }
  });

// ─────────────────────────────────────────────────────────────
// ESTADO GENERAL DEL PEDIDO
// ─────────────────────────────────────────────────────────────

/**
 * Determina el nuevo estado general del pedido a partir de los ítems actualizados.
 *
 * @param {Array}  updatedItems   - Array de ítems tras aplicar la entrega
 * @param {string} estadoActual   - Estado actual (fallback si nada cambia)
 * @returns {string}
 */
export const calcularEstadoGeneral = (updatedItems, estadoActual) => {
  const todosEntregados = updatedItems.every(
    item => esItemInactivo(item) || item.estadoItem === 'Entregado'
  );
  const hayEnProduccion = updatedItems.some(
    item => !esItemInactivo(item) &&
      ((item.cantidadLista || 0) + (item.cantidadEntregada || 0)) < item.cantidad
  );
  const todosListosOEntregados = updatedItems.every(
    item => esItemInactivo(item) ||
      ((item.cantidadLista || 0) + (item.cantidadEntregada || 0)) === item.cantidad
  );

  if (todosEntregados) return 'Entregado';
  if (hayEnProduccion) return 'En Proceso';
  if (todosListosOEntregados) return 'Pedido Completo - Listo para Recoger';
  return estadoActual;
};

/**
 * Deriva el estadoGeneral correcto de un pedido a partir de sus ítems.
 * Usada por fetchPedidos para autocorregir estados desincronizados.
 *
 * Reglas clave (el orden importa):
 *  1. Pedido anulado/cancelado: NO se recalcula. Si el flag `anulado` está
 *     desincronizado con un estadoGeneral vivo (zombis legacy, anti-patrón #1),
 *     se normaliza a 'Anulado' (o 'Cancelado' si ese era el estadoGeneral).
 *     Sin esto, un pedido anulado con ítems 'Listo para Entrega' se "resucitaba"
 *     como activo → habilitaba doble anulación y entregas sobre pedidos muertos.
 *  2. Sin ítems (o todos inactivos): se conserva el estadoGeneral actual.
 *  3. En otro caso, se deriva de los estadoItem de los ítems activos.
 *
 * @param {Object} pedido - doc de `pedidos` (estadoGeneral, anulado, items[])
 * @returns {string} estadoGeneral correcto
 */
export const calcularEstadoCorrectoPedido = (pedido) => {
  if (pedido.anulado === true) {
    return pedido.estadoGeneral === 'Cancelado' ? 'Cancelado' : 'Anulado';
  }
  if (pedido.estadoGeneral === 'Anulado' || pedido.estadoGeneral === 'Cancelado') {
    return pedido.estadoGeneral;
  }
  if (!pedido.items || pedido.items.length === 0) return pedido.estadoGeneral;

  // Excluir ítems anulados y cambios de talla (no son entregables)
  const itemsActivos = pedido.items.filter(item => !esItemInactivo(item));
  if (itemsActivos.length === 0) return pedido.estadoGeneral;

  const todosEntregados = itemsActivos.every(item => item.estadoItem === 'Entregado');
  const anyInProduction = itemsActivos.some(item => item.estadoItem === 'En Producción');
  const allReadyOrDelivered = itemsActivos.every(
    item => item.estadoItem === 'Listo para Entrega' ||
            item.estadoItem === 'Entregado' ||
            item.estadoItem === 'Parcialmente Listo'
  );

  if (todosEntregados) return 'Entregado';
  if (anyInProduction) return 'En Proceso';
  if (allReadyOrDelivered) return 'Pedido Completo - Listo para Recoger';
  return pedido.estadoGeneral;
};
