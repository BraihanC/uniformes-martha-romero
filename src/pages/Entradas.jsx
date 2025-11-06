import { Outlet, NavLink } from 'react-router-dom';
import { Truck, Package } from 'lucide-react';

// Estilo base para las pestañas de navegación
const navLinkStyle = "flex items-center gap-2 px-4 py-3 font-medium border-b-4 transition-all";
// Estilo para la pestaña activa (usaremos el color naranja)
const activeStyle = "border-orange-500 text-orange-600";
// Estilo para la pestaña inactiva
const inactiveStyle = "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300";

const EntradasLayout = () => {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Encabezado principal */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestión de Entradas</h1>
        <p className="text-gray-600 mt-1">Registra la entrada de mercancía al inventario.</p>
      </div>

      {/* Menú de Navegación de Entradas (Pestañas) */}
      <nav className="flex border-b border-gray-200 mb-6">
        <NavLink
          to="/entradas/satelite"
          className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          <Package size={18} />
          Entrada de Satélite (Producción)
        </NavLink>
        <NavLink
          to="/entradas/proveedor"
          className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          <Truck size={18} />
          Compra a Proveedor
        </NavLink>
      </nav>

      {/* Contenedor donde se renderizará el sub-módulo */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default EntradasLayout;
