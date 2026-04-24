import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { usePortalAuth } from './PortalAuthContext';

const NotificacionesContext = createContext({});

export const useNotificaciones = () => {
  const context = useContext(NotificacionesContext);
  if (!context) {
    throw new Error('useNotificaciones must be used within a NotificacionesProvider');
  }
  return context;
};

export const NotificacionesProvider = ({ children }) => {
  const { clienteCorporativo } = usePortalAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    if (!clienteCorporativo?.id) return;

    // Escuchar notificaciones en tiempo real
    const notificacionesRef = collection(db, 'notificaciones_portal');
    const q = query(
      notificacionesRef,
      where('clienteId', '==', clienteCorporativo.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setNotificaciones(notifs);
      setNoLeidas(notifs.filter(n => !n.leida).length);
    }, (error) => {
      console.error('Error al escuchar notificaciones:', error);
    });

    return () => unsubscribe();
  }, [clienteCorporativo]);

  const marcarComoLeida = async (notificacionId) => {
    try {
      const notifRef = doc(db, 'notificaciones_portal', notificacionId);
      await updateDoc(notifRef, {
        leida: true,
        fechaLeida: new Date()
      });
    } catch (error) {
      console.error('Error al marcar como leída:', error);
    }
  };

  const marcarTodasComoLeidas = async () => {
    try {
      const promises = notificaciones
        .filter(n => !n.leida)
        .map(n => {
          const notifRef = doc(db, 'notificaciones_portal', n.id);
          return updateDoc(notifRef, {
            leida: true,
            fechaLeida: new Date()
          });
        });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  const value = {
    notificaciones,
    noLeidas,
    marcarComoLeida,
    marcarTodasComoLeidas
  };

  return (
    <NotificacionesContext.Provider value={value}>
      {children}
    </NotificacionesContext.Provider>
  );
};

export default NotificacionesContext;
