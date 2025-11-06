import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged // <-- Importante: Cambiamos onAuthStateChanged por esto
} from 'firebase/auth';
// Ya no necesitamos 'db' ni 'firestore' para los roles
import { auth } from '../services/firebase';

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

  // Login function (sin cambios)
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
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

  // ¡Lógica de Roles Mejorada!
  // Ya no necesitamos 'fetchUserRole' desde Firestore.

  // Listen to ID token changes (esto incluye los Custom Claims)
  useEffect(() => {
    // onIdTokenChanged es como onAuthStateChanged pero nos da acceso a los claims del token
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
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
