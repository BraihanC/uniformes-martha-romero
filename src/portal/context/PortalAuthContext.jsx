import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../../services/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

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

  // Verificar si el usuario es un cliente corporativo
  const verificarClienteCorporativo = async (user) => {
    if (!user) {
      setClienteCorporativo(null);
      return null;
    }

    try {
      const clientesRef = collection(db, 'clientes_corporativos');
      const q = query(clientesRef, where('credenciales.email', '==', user.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const clienteData = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        };
        setClienteCorporativo(clienteData);
        return clienteData;
      } else {
        setError('Este usuario no tiene acceso al portal corporativo');
        await signOut(auth);
        return null;
      }
    } catch (err) {
      setError('Error al verificar credenciales');
      return null;
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
      const cliente = await verificarClienteCorporativo(userCredential.user);

      if (!cliente) {
        throw new Error('No tienes acceso al portal corporativo');
      }

      return { success: true, cliente };
    } catch (err) {
      let errorMessage = 'Error al iniciar sesión';

      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
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
