import { Outlet, NavLink } from 'react-router-dom';
import { DollarSign, Search, Scissors, Users, BarChart3, FileSearch, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Estilo base para las pestañas de navegación
const navLinkStyle = "flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-medium border-b-4 transition-all";
// Estilo para la pestaña activa
const activeStyle = "border-pink-600 text-pink-600";
// Estilo para la pestaña inactiva
const inactiveStyle = "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300";

const ReportesLayout = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Encabezado principal */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Reportes</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Centro de análisis y reportes del sistema.</p>
      </div>

      {/* Menú de Navegación de Reportes (Pestañas) */}
      <nav className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {/* Pestañas para todos los usuarios */}
        <NavLink
          to="/reportes/cierre"
          className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          <DollarSign size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline">Cierre de Caja</span>
          <span className="sm:hidden whitespace-nowrap">Cierre</span>
        </NavLink>
        <NavLink
          to="/reportes/facturas"
          className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          <Search size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline">Buscador de Facturas</span>
          <span className="sm:hidden whitespace-nowrap">Facturas</span>
        </NavLink>
        <NavLink
          to="/reportes/corte"
          className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          <Scissors size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline">Reporte de Corte</span>
          <span className="sm:hidden whitespace-nowrap">Corte</span>
        </NavLink>
        <NavLink
          to="/reportes/ventas"
          className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          <ShoppingBag size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline">Ventas por Prenda</span>
          <span className="sm:hidden whitespace-nowrap">Ventas</span>
        </NavLink>
        {/* Cuentas por Pagar: visible para staff (vendedor gestiona pagos a satélites) */}
        <NavLink
          to="/reportes/cuentas-por-pagar"
          className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
        >
          <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline">Cuentas por Pagar</span>
          <span className="sm:hidden whitespace-nowrap">Cuentas</span>
        </NavLink>

        {/* Pestañas solo para administradores */}
        {isAdmin && (
          <>
            <NavLink
              to="/reportes/diagnostico-b2b"
              className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
            >
              <FileSearch size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Diagnóstico B2B</span>
              <span className="sm:hidden whitespace-nowrap">Diagnóstico</span>
            </NavLink>
            <NavLink
              to="/reportes/analisis"
              className={({ isActive }) => `${navLinkStyle} ${isActive ? activeStyle : inactiveStyle}`}
            >
              <BarChart3 size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Análisis de Negocio</span>
              <span className="sm:hidden whitespace-nowrap">Análisis</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Contenedor donde se renderizará el sub-módulo (CierreCaja, etc.) */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default ReportesLayout;
