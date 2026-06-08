/**
 * apartadosLogic.js
 * Lógica pura de apartados (layaway): abonos, saldo, estado y vencimiento.
 * Sin Firebase, sin React. Las fechas se reciben como Date (el componente hace
 * el .toDate() del Timestamp antes de llamar). 100% testable con: npm test
 */

// ─────────────────────────────────────────────────────────────
// ABONOS Y SALDO
// ─────────────────────────────────────────────────────────────

/**
 * Suma el monto de todos los abonos.
 */
export const calcularTotalAbonado = (abonos = []) =>
  abonos.reduce((sum, a) => sum + (a.monto || 0), 0);

/**
 * Recalcula el total del apartado sumando solo los items NO anulados.
 */
export const recalcularTotalApartado = (items = []) =>
  items.filter(i => !i.anulado).reduce((sum, i) => sum + (i.subtotal || 0), 0);

// ─────────────────────────────────────────────────────────────
// ESTADO TRAS ABONO
// ─────────────────────────────────────────────────────────────

/**
 * Calcula el nuevo estado del apartado tras registrar un abono.
 *
 * Reglas (replica el comportamiento corregido):
 *  - Si el saldo llega a 0 (o menos) → 'Completado'.
 *  - Si NO se completa y el apartado estaba 'Vencido' → sigue 'Vencido'
 *    (no se rebaja a 'Activo' por un abono parcial).
 *  - En cualquier otro caso → 'Activo'.
 *
 * @param {Object} p
 * @param {string} p.estadoActual   - estadoGeneral actual del apartado
 * @param {number} p.totalApartado  - total del apartado
 * @param {number} p.totalAbonado   - total abonado DESPUÉS del nuevo abono
 * @returns {{ saldoPendiente: number, completado: boolean, estadoGeneral: string }}
 */
export const calcularEstadoTrasAbono = ({ estadoActual, totalApartado, totalAbonado }) => {
  const saldoPendiente = totalApartado - totalAbonado;
  const completado = saldoPendiente <= 0;
  const estadoGeneral = completado
    ? 'Completado'
    : (estadoActual === 'Vencido' ? 'Vencido' : 'Activo');
  return { saldoPendiente, completado, estadoGeneral };
};

// ─────────────────────────────────────────────────────────────
// VENCIMIENTO
// ─────────────────────────────────────────────────────────────

/**
 * ¿El apartado está vencido? Compara la fecha límite contra "hoy" a medianoche.
 * Es exclusivo: el día límite NO se considera vencido (vence al día siguiente).
 *
 * @param {Date|null} fechaLimite
 * @param {Date} hoy - referencia (normalmente new Date())
 * @returns {boolean}
 */
export const estaVencido = (fechaLimite, hoy) => {
  if (!fechaLimite) return false;
  const limite = new Date(fechaLimite);
  limite.setHours(0, 0, 0, 0);
  const ref = new Date(hoy);
  ref.setHours(0, 0, 0, 0);
  return limite < ref;
};

/**
 * Días restantes hasta la fecha límite (negativo si ya pasó).
 * @param {Date|null} fechaLimite
 * @param {Date} hoy - referencia
 * @returns {number|null} null si no hay fecha límite
 */
export const calcularDiasRestantes = (fechaLimite, hoy) => {
  if (!fechaLimite) return null;
  const limite = new Date(fechaLimite);
  return Math.ceil((limite - new Date(hoy)) / (1000 * 60 * 60 * 24));
};
