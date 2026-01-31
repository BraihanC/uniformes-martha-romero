import { useState } from 'react';
import { TrendingUp, BarChart3, Wallet, Package } from 'lucide-react';
import ReporteUtilidad from './ReporteUtilidad';
import ReporteVentas from './ReporteVentas';
import ReporteIngresos from './ReporteIngresos';
import AnalisisB2B from './AnalisisB2B';

const ReportesAnalisis = () => {
  const [activeTab, setActiveTab] = useState('utilidad');

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Reportes de Análisis</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          Utilidad de productos, ventas e ingresos del negocio
        </p>
      </div>

      {/* Pestañas de navegación */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 sm:gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('utilidad')}
            className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'utilidad'
                ? 'border-pink-600 text-pink-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <TrendingUp size={18} />
            <span className="text-sm sm:text-base">Utilidad de Productos</span>
          </button>
          <button
            onClick={() => setActiveTab('ventas')}
            className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'ventas'
                ? 'border-pink-600 text-pink-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <BarChart3 size={18} />
            <span className="text-sm sm:text-base">Reporte de Ventas</span>
          </button>
          <button
            onClick={() => setActiveTab('ingresos')}
            className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'ingresos'
                ? 'border-pink-600 text-pink-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Wallet size={18} />
            <span className="text-sm sm:text-base">Reporte de Ingresos</span>
          </button>
          <button
            onClick={() => setActiveTab('b2b')}
            className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'b2b'
                ? 'border-pink-600 text-pink-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Package size={18} />
            <span className="text-sm sm:text-base">Análisis B2B</span>
          </button>
        </div>
      </div>

      {/* Contenido de las pestañas */}
      <div>
        {activeTab === 'utilidad' && <ReporteUtilidad />}
        {activeTab === 'ventas' && <ReporteVentas />}
        {activeTab === 'ingresos' && <ReporteIngresos />}
        {activeTab === 'b2b' && <AnalisisB2B />}
      </div>
    </div>
  );
};

export default ReportesAnalisis;
