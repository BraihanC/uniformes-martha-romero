import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../../services/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { normalizarEmailB2B, clientePortalActivo } from '../../utils/pedidosB2BLogic';

const PortalAuthContext = createContext();

export const usePortalAuth = () => {
  const context = useContext(PortalAuthContext);
  if (!context) {
    throw new Error('usePortalAuth debe usarse dentro de PortalAuthProvider');
  }
  return context;
};

export const PortalAuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [clienteCorporativo, setClienteCorporativo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar si el usuario es un cliente corporativo con acceso vigente.
  // Devuelve { cliente, motivo }: el motivo explica POR QUÉ se rechazó, para que
  // el login no lo reemplace por un mensaje genérico ("no tienes acceso") cuando
  // la causa real es que el cliente está desactivado.
  const verificarClienteCorporativo = async (user) => {
    if (!user) {
      setClienteCorporativo(null);
      return { cliente: null, motivo: 'No hay una sesión activa.' };
    }

    try {
      const clientesRef = collection(db, 'clientes_corporativos');
      // El token de Auth trae el email normalizado; los documentos también se
      // guardan normalizados. Se compara sobre la misma forma para que una
      // mayúscula suelta no deje al cliente fuera de su propio portal.
      const q = query(
        clientesRef,
        where('credenciales.email', '==', normalizarEmailB2B(user.email))
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        const motivo = 'Este usuario no tiene acceso al portal corporativo.';
        setError(motivo);
        await signOut(auth);
        return { cliente: null, motivo };
      }

      const clienteData = {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      };

      // Baja del cliente: `activo: false` corta el acceso de verdad. Antes el
      // campo solo pintaba un badge en la tabla de administración y un cliente
      // "Inactivo" seguía entrando y creando pedidos.
      if (!clientePortalActivo(clienteData)) {
        const motivo = 'Tu acceso al portal está desactivado. Comunícate con Uniformes Martha Romero.';
        setError(motivo);
        setClienteCorporativo(null);
        await signOut(auth);
        return { cliente: null, motivo };
      }

      setClienteCorporativo(clienteData);
      return { cliente: clienteData, motivo: '' };
    } catch (err) {
      const motivo = 'Error al verificar credenciales';
      setError(motivo);
      return { cliente: null, motivo };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError(null);

      if (user) {
        setCurrentUser(user);
        await verificarClienteCorporativo(user);
      } else {
        setCurrentUser(null);
        setClienteCorporativo(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const { cliente, motivo } = await verificarClienteCorporativo(userCredential.user);

      if (!cliente) {
        // Se propaga el motivo real (desactivado / no es cliente / fallo de red)
        throw new Error(motivo || 'No tienes acceso al portal corporativo');
      }

      return { success: true, cliente };
    } catch (err) {
      let errorMessage = 'Error al iniciar sesión';

      if (err.code === 'auth/user-disabled') {
        // La cuenta se deshabilitó en Auth al desactivar el cliente
        errorMessage = 'Tu acceso al portal está desactivado. Comunícate con Uniformes Martha Romero.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        errorMessage = 'Email o contraseña incorrectos';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'Usuario no encontrado';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos. Intenta más tarde';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setClienteCorporativo(null);
      setError(null);
    } catch (err) {
      setError('Error al cerrar sesión');
    }
  };

  const value = {
    currentUser,
    clienteCorporativo,
    loading,
    error,
    login,
    logout,
    setError
  };

  return (
    <PortalAuthContext.Provider value={value}>
      {children}
    </PortalAuthContext.Provider>
  );
};

export default PortalAuthContext;
