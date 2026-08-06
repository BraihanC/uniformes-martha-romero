/**
 * Guardias de conexión para operaciones que NO funcionan offline.
 *
 * Contexto: la app tiene persistencia offline de Firestore (`persistentLocalCache`),
 * así que las LECTURAS sirven desde caché sin conexión. Pero hay tres tipos de
 * operación que fallan duro sin red y que ninguna caché puede resolver:
 *
 *   1. `runTransaction` — las transacciones exigen ida y vuelta al servidor. No se
 *      encolan ni se sirven de caché. Es lo que usan los consecutivos de factura,
 *      apartado y pedido B2B, y la validación de stock del POS.
 *   2. `getDocFromServer` — bypass explícito del caché, por definición requiere red.
 *   3. `httpsCallable` (Cloud Functions) — correos y gestión de usuarios.
 *
 * Sin esta guardia el usuario recibe un error crudo en inglés DESPUÉS de haber
 * llenado todo el formulario. Con ella falla antes, en español, y explica por qué.
 *
 * No cubre los writes encolables (addDoc/updateDoc/batch), que sí sincronizan
 * después — esos tienen otro problema (la promesa nunca resuelve offline) que se
 * maneja aparte.
 */

/** `true` solo cuando el navegador reporta con certeza que no hay red. */
export function estaOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Guardia para el inicio de un handler que requiere servidor.
 *
 * @param {string} accion - Qué se iba a hacer, en infinitivo y en español.
 *                          Ej: 'registrar la venta', 'crear el apartado'.
 * @returns {boolean} `true` si NO hay conexión (el handler debe abortar).
 *
 * @example
 *   const handleGenerateFactura = async () => {
 *     if (bloquearSinConexion('registrar la venta')) return;
 *     ...
 *   };
 */
export function bloquearSinConexion(accion) {
  if (!estaOffline()) return false;

  alert(
    `Sin conexión a internet.\n\n` +
    `No se puede ${accion} mientras no haya red: el sistema necesita el servidor ` +
    `para asignar el consecutivo y verificar el stock disponible en ese momento.\n\n` +
    `No se guardó nada. Revisa la conexión y vuelve a intentar — la información del ` +
    `formulario sigue aquí.`
  );
  return true;
}

/** Igual que `bloquearSinConexion`, con el texto para envíos de correo. */
export function bloquearEnvioSinConexion(queSeEnvia) {
  if (!estaOffline()) return false;

  alert(
    `Sin conexión a internet.\n\n` +
    `No se puede enviar ${queSeEnvia} sin red. La operación en sí ya quedó registrada; ` +
    `solo falta el correo, que puedes reenviar cuando vuelva la conexión.`
  );
  return true;
}
