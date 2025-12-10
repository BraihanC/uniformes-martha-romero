import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../context/PortalAuthContext';
import FloatingCart from './FloatingCart';
import {
  ShoppingBag,
  Package,
  AlertCircle,
  LogOut,
  Menu,
  X,
  User
} from 'lucide-react';

const PortalLayout = () => {
  const { clienteCorporativo, logout } = usePortalAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que deseas cerrar sesión?')) {
      await logout();
      navigate('/portal/login');
    }
  };

  const navItems = [
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

            {/* User Info y Logout */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                <User size={18} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {clienteCorporativo?.contacto || 'Usuario'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span>Salir</span>
              </button>
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
              {/* User Info Mobile */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg mb-4">
                <User size={18} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {clienteCorporativo?.contacto || 'Usuario'}
                </span>
              </div>

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
