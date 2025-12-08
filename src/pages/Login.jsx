import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  // Cargar el logo de la empresa
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const docRef = doc(db, 'config', 'company');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().logoUrl) {
          setLogoUrl(docSnap.data().logoUrl);
        }
      } catch (error) {
        console.error('Error al cargar el logo:', error);
      }
    };
    fetchLogo();
  }, []);

  // Redireccionar si el usuario ya está logueado
  useEffect(() => {
    // El AuthContext ya manejó el 'loading'.
    // Si currentUser NO es null, significa que ya hay una sesión activa.
    if (currentUser) {
      navigate('/dashboard'); // O a la ruta principal que prefieras
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);

      // User-friendly error messages
      if (error.message && error.message.includes('Portal B2B')) {
        setError(error.message);
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos');
      } else if (error.code === 'auth/invalid-email') {
        setError('Correo electrónico inválido');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Intenta más tarde');
      } else {
        setError('Error al iniciar sesión. Por favor intenta nuevamente');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-beige to-bg-blue px-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <div className="mb-4">
              <img
                src={logoUrl}
                alt="Logo Uniformes Martha Romero"
                className="w-full max-w-xs mx-auto h-auto object-contain"
              />
            </div>
          ) : (
            <div className="inline-block bg-white rounded-full p-6 shadow-lg mb-4">
              <svg
                className="w-16 h-16 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-800">Uniformes Martha Romero</h1>
          <p className="text-gray-600 mt-2">Sistema de Punto de Venta</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Iniciar Sesión</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="email">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="tu@email.com"
                required
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-opacity-90 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>¿Olvidaste tu contraseña?</p>
            <p className="mt-1">Contacta al administrador del sistema</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-600">
          <p>&copy; 2025 Uniformes Martha Romero. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
