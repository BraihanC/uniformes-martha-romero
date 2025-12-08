import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged // <-- Importante: Cambiamos onAuthStateChanged por esto
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Login function
  const login = async (email, password) => {
    try {
      // Primero autenticar al usuario
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Luego verificar si es cliente corporativo
      const esB2B = await esClienteCorporativo(email);

      if (esB2B) {
        // Si es B2B, cerrar la sesión inmediatamente
        await signOut(auth);
        throw new Error('Este usuario solo tiene acceso al Portal B2B. Por favor ingresa en /portal/login');
      }

      return userCredential.user;
    } catch (error) {
      throw error;
    }
  };

  // Logout function (sin cambios)
  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserRole(null);
    } catch (error) {
      throw error;
    }
  };

  // Verificar si el usuario es un cliente corporativo (B2B)
  const esClienteCorporativo = async (userEmail) => {
    try {
      const clientesRef = collection(db, 'clientes_corporativos');
      const q = query(clientesRef, where('credenciales.email', '==', userEmail));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error verificando cliente corporativo:', error);
      return false;
    }
  };

  // ¡Lógica de Roles Mejorada!
  // Ya no necesitamos 'fetchUserRole' desde Firestore.

  // Listen to ID token changes (esto incluye los Custom Claims)
  useEffect(() => {
    // onIdTokenChanged es como onAuthStateChanged pero nos da acceso a los claims del token
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        // Verificar si el usuario es un cliente corporativo (B2B)
        const esB2B = await esClienteCorporativo(user.email);

        if (esB2B) {
          // Si es cliente B2B, bloquear acceso a la aplicación principal
          await signOut(auth);
          setCurrentUser(null);
          setUserRole(null);
          setLoading(false);
          alert('Este usuario tiene acceso únicamente al Portal B2B. Por favor ingresa en: ' + window.location.origin + '/portal/login');
          return;
        }

        setCurrentUser(user);

        // Forzamos al token a refrescarse para obtener los claims más recientes
        // (Esto es crucial si el rol cambia mientras el usuario está logueado)
        const tokenResult = await user.getIdTokenResult(true);

        // Leemos el rol desde los claims del token, no desde Firestore
        const role = tokenResult.claims.role || 'vendedor';
        setUserRole(role);

      } else {
        // Usuario está deslogueado
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    logout,
    // Esta lógica ahora funciona con los Custom Claims
    isAdmin: userRole === 'admin',
    isVendedor: userRole === 'vendedor',
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
