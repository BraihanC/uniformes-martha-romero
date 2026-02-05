import { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Mostrar mensaje de reconexión brevemente
        setShowBanner(true);
        setTimeout(() => setShowBanner(false), 3000);
      }
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Mostrar banner si inicia offline
    if (!navigator.onLine) {
      setShowBanner(true);
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // No mostrar nada si está online y no hay banner
  if (isOnline && !showBanner) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        isOnline
          ? 'bg-green-600 text-white'
          : 'bg-amber-500 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi size={20} />
          <div>
            <p className="font-medium text-sm">Conexión restaurada</p>
            <p className="text-xs opacity-90">Sincronizando datos...</p>
          </div>
          <RefreshCw size={16} className="animate-spin ml-2" />
        </>
      ) : (
        <>
          <WifiOff size={20} />
          <div>
            <p className="font-medium text-sm">Sin conexión a Internet</p>
            <p className="text-xs opacity-90">Modo offline activo - Los datos se guardarán localmente</p>
          </div>
          <CloudOff size={16} className="ml-2" />
        </>
      )}
    </div>
  );
};

export default ConnectionStatus;
