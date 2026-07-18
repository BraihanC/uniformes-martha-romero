/**
 * consecutivos.js
 * Consecutivo de pedidos B2B vía runTransaction sobre counters/pedidos_b2b.
 *
 * Reemplaza el patrón "leer max numeroPedido + 1" que tenía dos problemas:
 *  1. Permisos: la query global sobre pedidos_b2b viola la regla de lectura
 *     por clienteEmail → "Missing or insufficient permissions" en el portal
 *     (anti-patrón #6 del repo).
 *  2. Race: dos pedidos simultáneos obtenían el mismo número (anti-patrón #5).
 *
 * Las reglas de Firestore solo permiten al cliente B2B el incremento exacto
 * de +1 sobre lastNumber (ver match /counters/pedidos_b2b en firestore.rules).
 * El doc counters/pedidos_b2b lo siembra un admin; si falta, se lanza un
 * error claro en lugar de arrancar en 1 y duplicar consecutivos.
 */
import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

export const obtenerSiguienteNumeroPedidoB2B = async () => {
  const counterRef = doc(db, 'counters', 'pedidos_b2b');
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    if (!snap.exists()) {
      throw new Error(
        'El consecutivo de pedidos B2B no está inicializado. Contacta al administrador.'
      );
    }
    const nextNumero = (snap.data().lastNumber || 0) + 1;
    transaction.update(counterRef, { lastNumber: nextNumero });
    return nextNumero;
  });
};
