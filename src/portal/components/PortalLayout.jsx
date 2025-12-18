import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../context/PortalAuthContext';
import { useNotificaciones } from '../context/NotificacionesContext';
import FloatingCart from './FloatingCart';
import {
  ShoppingBag,
  Package,
  AlertCircle,
  LogOut,
  Menu,
  X,
  User,
  Bell,
  LayoutDashboard,
  Settings
} from 'lucide-react';

const PortalLayout = () => {
  const { clienteCorporativo, logout } = usePortalAuth();
  const { notificaciones, noLeidas, marcarComoLeida, marcarTodasComoLeidas } = useNotificaciones();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificacionesOpen, setNotificacionesOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const navigate = useNavigate();
  const notificacionesRef = useRef(null);
  const perfilRef = useRef(null);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificacionesRef.current && !notificacionesRef.current.contains(event.target)) {
        setNotificacionesOpen(false);
      }
      if (perfilRef.current && !perfilRef.current.contains(event.target)) {
        setPerfilOpen(false);
      }
    };

    if (notificacionesOpen || perfilOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificacionesOpen, perfilOpen]);

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que deseas cerrar sesión?')) {
      await logout();
      navigate('/portal/login');
    }
  };

  const navItems = [
    {
      path: '/portal/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard'
    },
    {
      path: '/portal/catalogo',
      icon: ShoppingBag,
      label: 'Catálogo'
    },
    {
      path: '/portal/mis-pedidos',
      icon: Package,
      label: 'Mis Pedidos'
    },
    {
      path: '/portal/reportar-imperfecto',
      icon: AlertCircle,
      label: 'Reportar Imperfecto'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y Nombre del Colegio */}
            <div className="flex items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {clienteCorporativo?.nombre || 'Portal Corporativo'}
                </h1>
                <p className="text-xs text-gray-500">
                  Uniformes Martha Romero
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                  style={({ isActive }) => (isActive ? { backgroundColor: '#D50565' } : {})}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Notificaciones, User Info y Logout */}
            <div className="hidden md:flex items-center gap-4">
              {/* Botón de Notificaciones */}
              <div className="relative" ref={notificacionesRef}>
                <button
                  onClick={() => setNotificacionesOpen(!notificacionesOpen)}
                  className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Bell size={20} />
                  {noLeidas > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {noLeidas > 9 ? '9+' : noLeidas}
                    </span>
                  )}
                </button>

                {/* Dropdown de Notificaciones */}
                {notificacionesOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-800">Notificaciones</h3>
                      {noLeidas > 0 && (
                        <button
                          onClick={marcarTodasComoLeidas}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Marcar todas como leídas
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notificaciones.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                          <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No tienes notificaciones</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {notificaciones.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (!notif.leida) marcarComoLeida(notif.id);
                                setNotificacionesOpen(false);
                              }}
                              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                                !notif.leida ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {!notif.leida && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                )}
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
                  </div>
                )}
              </div>

              {/* Dropdown de Perfil */}
              <div className="relative" ref={perfilRef}>
                <button
                  onClick={() => setPerfilOpen(!perfilOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <User size={18} className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {clienteCorporativo?.contacto || 'Usuario'}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {perfilOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    {/* Información del Perfil */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: '#D50565' }}>
                          {(clienteCorporativo?.contacto || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {clienteCorporativo?.contacto || 'Usuario'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {clienteCorporativo?.nombre || 'Institución'}
                          </p>
                        </div>
                      </div>

                      {/* Datos del Perfil */}
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500">Email:</span>
                          <p className="font-medium text-gray-900 truncate">
                            {clienteCorporativo?.credenciales?.email || 'No disponible'}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Código:</span>
                          <p className="font-medium text-gray-900">
                            {clienteCorporativo?.codigoColegio || 'N/A'}
                          </p>
                        </div>
                        {clienteCorporativo?.telefono && (
                          <div>
                            <span className="text-gray-500">Teléfono:</span>
                            <p className="font-medium text-gray-900">
                              {clienteCorporativo.telefono}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Opciones */}
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setPerfilOpen(false);
                          navigate('/portal/cambiar-contrasena');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings size={16} />
                        <span>Cambiar Contraseña</span>
                      </button>
                      <button
                        onClick={() => {
                          setPerfilOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={16} />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-2">
              {/* Perfil Mobile */}
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: '#D50565' }}>
                    {(clienteCorporativo?.contacto || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {clienteCorporativo?.contacto || 'Usuario'}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {clienteCorporativo?.nombre || 'Institución'}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <p className="truncate">
                    <span className="font-medium">Email:</span> {clienteCorporativo?.credenciales?.email || 'No disponible'}
                  </p>
                  <p>
                    <span className="font-medium">Código:</span> {clienteCorporativo?.codigoColegio || 'N/A'}
                  </p>
                  {clienteCorporativo?.telefono && (
                    <p>
                      <span className="font-medium">Tel:</span> {clienteCorporativo.telefono}
                    </p>
                  )}
                </div>
              </div>

              {/* Notificaciones Mobile */}
              {noLeidas > 0 && (
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={18} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        {noLeidas} {noLeidas === 1 ? 'notificación nueva' : 'notificaciones nuevas'}
                      </span>
                    </div>
                    <button
                      onClick={marcarTodasComoLeidas}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Marcar como leídas
                    </button>
                  </div>
                </div>
              )}

              {/* Nav Items Mobile */}
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                  style={({ isActive }) => (isActive ? { backgroundColor: '#D50565' } : {})}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}

              {/* Opciones de Perfil Mobile */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/portal/cambiar-contrasena');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings size={20} />
                <span className="font-medium">Cambiar Contraseña</span>
              </button>

              {/* Logout Mobile */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={20} />
                <span className="font-medium">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>© {new Date().getFullYear()} Uniformes Martha Romero</p>
            <p className="mt-1">Portal Corporativo - {clienteCorporativo?.nombre}</p>
          </div>
        </div>
      </footer>

      {/* Floating Cart */}
      <FloatingCart />
    </div>
  );
};

export default PortalLayout;
