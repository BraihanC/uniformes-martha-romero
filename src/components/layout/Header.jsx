import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const { currentUser, logout, userRole } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const notificacionesRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notificacionesRef.current && !notificacionesRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to admin notifications
  useEffect(() => {
    const notificacionesRef = collection(db, 'notificaciones_admin');
    const q = query(
      notificacionesRef,
      where('leida', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotificaciones(notifs);
      setNoLeidas(notifs.length);
    }, (error) => {
      console.error('Error al escuchar notificaciones:', error);
    });

    return () => unsubscribe();
  }, []);

  const marcarComoLeida = async (notificacionId) => {
    try {
      const notifRef = doc(db, 'notificaciones_admin', notificacionId);
      await updateDoc(notifRef, {
        leida: true
      });
    } catch (error) {
      console.error('Error al marcar como leída:', error);
    }
  };

  const handleNotificacionClick = async (notif) => {
    await marcarComoLeida(notif.id);
    setShowNotifications(false);
    // Navigate to relevant page based on notification type
    if (notif.tipo === 'nuevo_pedido_b2b') {
      navigate('/pedidos-b2b');
    } else if (notif.tipo === 'reporte_imperfecto') {
      navigate('/reportes-imperfectos');
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return currentUser?.email?.[0]?.toUpperCase() || 'U';
  };

  const getRoleName = () => {
    return userRole === 'admin' ? 'Administrador' : 'Vendedor';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between pl-16 lg:pl-6 pr-4 sm:pr-6 py-3 sm:py-4">
        {/* Page title */}
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800">
            Bienvenido
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Notifications and User menu */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <div className="relative" ref={notificacionesRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {/* Bell Icon */}
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>

              {/* Badge */}
              {noLeidas > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {noLeidas > 9 ? '9+' : noLeidas}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-800">Notificaciones</h3>
                </div>

                {notificaciones.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <svg
                      className="w-12 h-12 mx-auto mb-2 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    <p className="text-sm">No tienes notificaciones nuevas</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notificaciones.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificacionClick(notif)}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">
                              {notif.titulo}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {notif.mensaje}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              {notif.createdAt?.toDate?.()?.toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 lg:gap-3 hover:bg-gray-50 rounded-lg p-1.5 sm:p-2 transition-colors"
          >
            {/* User Avatar */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm sm:text-base">
              {getUserInitials()}
            </div>

            {/* User Info */}
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-gray-800">
                {currentUser?.displayName || currentUser?.email}
              </p>
              <p className="text-xs text-gray-600">{getRoleName()}</p>
            </div>

            {/* Dropdown Icon */}
            <svg
              className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform ${
                showDropdown ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {currentUser?.email}
                </p>
                <p className="text-xs text-gray-600">{getRoleName()}</p>
              </div>

              <button
                onClick={() => {
                  setShowDropdown(false);
                  navigate('/perfil');
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Mi Perfil
              </button>

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Cerrar Sesión
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
