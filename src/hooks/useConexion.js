import { useState, useEffect } from 'react';

/**
 * Estado de conexión del navegador.
 *
 * OJO con la semántica de `navigator.onLine`: es asimétrico.
 *   - `false` es CONFIABLE  → no hay interfaz de red, seguro estamos offline.
 *   - `true`  NO garantiza nada → puede haber wifi conectado sin salida a internet
 *     (el caso típico del local: el router prendido pero sin servicio).
 *
 * Por eso en toda la app usamos esto SOLO para bloquear cuando es `false`.
 * Nunca para asumir que una escritura va a funcionar porque es `true`.
 */
export function useConexion() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Resincronizar por si el estado cambió entre el useState inicial y el efecto.
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isOffline: !isOnline };
}

export default useConexion;
