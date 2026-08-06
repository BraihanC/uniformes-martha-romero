import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useConexion } from '../../hooks/useConexion';

/**
 * Banner de estado de conexión.
 *
 * IMPORTANTE — el texto tiene que ser honesto. La versión anterior decía
 * "Modo offline activo - Los datos se guardarán localmente", lo cual es FALSO para
 * los flujos que más importan: POS, Pedidos, Apartados y Pedidos B2B usan
 * `runTransaction` (consecutivos + verificación de stock) y las transacciones de
 * Firestore no funcionan sin servidor. Prometer que "se guarda localmente" hacía que
 * la vendedora intentara facturar y recibiera un error crudo en inglés.
 *
 * Lo que SÍ funciona offline son las lecturas, que salen del caché de Firestore.
 */
const ConnectionStatus = () => {
  const { isOnline } = useConexion();
  const [showBanner, setShowBanner] = useState(!navigator.onLine);
  const estuvoOffline = useRef(!navigator.onLine);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isOnline) {
      // Offline: el banner se queda fijo hasta que vuelva la conexión.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      estuvoOffline.current = true;
      setShowBanner(true);
      return;
    }

    // Online: solo mostramos "conexión restaurada" si veníamos de estar caídos.
    if (estuvoOffline.current) {
      estuvoOffline.current = false;
      setShowBanner(true);
      timeoutRef.current = setTimeout(() => setShowBanner(false), 4000);
    } else {
      setShowBanner(false);
    }
  }, [isOnline]);

  // Limpiar el timeout al desmontar para no hacer setState sobre un componente muerto.
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (isOnline && !showBanner) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-4 z-50 flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${
        isOnline ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Conexión restaurada</p>
            <p className="text-xs opacity-90">Ya puedes registrar ventas y pedidos.</p>
          </div>
          <RefreshCw size={16} className="animate-spin ml-2 shrink-0 mt-0.5" />
        </>
      ) : (
        <>
          <WifiOff size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Sin conexión a internet</p>
            <p className="text-xs opacity-90 mt-0.5">
              Puedes <strong>consultar</strong> inventario, clientes y pedidos, pero{' '}
              <strong>no registrar</strong> ventas, pedidos, apartados ni abonos hasta
              que vuelva la conexión.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ConnectionStatus;
