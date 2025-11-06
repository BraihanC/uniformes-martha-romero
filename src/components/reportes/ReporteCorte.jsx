import { useState, useEffect } from 'react';
import { db } from '../../services/firebase'; // Ajustado a ../../
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { Scissors, FileDown, Printer } from 'lucide-react';
import { CSVLink } from 'react-csv'; // Importar la nueva librería

// Helper (de CierreCaja.jsx)
const formatDateForInput = (date) => {
  if (!date) return '';
  const localDate = new Date(date.getTime());
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().split('T')[0];
};

const ReporteCorte = () => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]); // El reporte agrupado
  const [csvData, setCsvData] = useState([]); // Datos para el CSV

  // Estados para los filtros
  // Queremos ver todo lo que NO esté 'Entregado'
  const [filtroEstado, setFiltroEstado] = useState('Pendientes');

  /**
   * Función principal que busca y procesa los pedidos para corte
   */
  const handleFetchReporteCorte = async () => {
    setLoading(true);
    setReportData([]);
    setCsvData([]);

    // 1. Definir rango de fechas
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const startTimestamp = Timestamp.fromDate(start);
    const endTimestamp = Timestamp.fromDate(end);

    try {
      // 2. Crear la consulta a 'pedidos'
      const pedidosRef = collection(db, 'pedidos');
      let q = query(
        pedidosRef,
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp)
      );

      // 3. Aplicar filtro de estado
      // (Esta es la lógica que define qué ve "Corte")
      if (filtroEstado === 'Pendientes') {
         // Buscamos pedidos que NO estén Entregados
        q = query(q, where('estadoGeneral', '!=', 'Entregado'));
      }
      // 'Todos' no necesita filtro de estado

      const querySnapshot = await getDocs(q);
      const pedidos = querySnapshot.docs.map(doc => doc.data());

      // 4. Procesar y Aplanar los datos
      const itemsAplanados = [];
      pedidos.forEach(pedido => {
        // Solo procesamos items que estén 'En Producción'
        const itemsParaCorte = pedido.items.filter(
          item => item.estadoItem === 'En Producción'
        );

        itemsParaCorte.forEach(item => {
          // Usar el colegio guardado directamente en el pedido
          const colegioNombre = pedido.colegioNombre || 'General (Sin Colegio)';

          itemsAplanados.push({
            colegio: colegioNombre,
            prenda: item.nombre,
            referencia: item.referencia || '',
            talla: item.talla || 'Única',
            cantidad: item.cantidad,
            observaciones: pedido.observaciones || '',
            pedidoNum: pedido.numeroPedido || 'N/A'
          });
        });
      });

      // 5. Agrupar los datos (¡La magia!)
      const agrupado = itemsAplanados.reduce((acc, item) => {
        // Creamos una llave única por cada grupo
        const key = `${item.colegio}|${item.prenda}|${item.talla}|${item.observaciones}`;

        if (!acc[key]) {
          // Si no existe, lo creamos
          acc[key] = {
            colegio: item.colegio,
            prenda: item.prenda,
            talla: item.talla,
            observaciones: item.observaciones,
            cantidadTotal: 0,
            referencias: new Set(),
            pedidos: new Set()
          };
        }

        // Sumamos la cantidad y añadimos las referencias
        acc[key].cantidadTotal += item.cantidad;
        acc[key].referencias.add(item.referencia);
        acc[key].pedidos.add(item.pedidoNum);

        return acc;
      }, {});

      // 6. Convertir el objeto agrupado en un Array y formatear
      const reporteFinal = Object.values(agrupado).map(g => ({
        ...g,
        referencias: Array.from(g.referencias).join(', '),
        pedidos: Array.from(g.pedidos).join(', ')
      }));

      // Ordenar por colegio y luego por prenda
      reporteFinal.sort((a, b) => {
        if (a.colegio < b.colegio) return -1;
        if (a.colegio > b.colegio) return 1;
        if (a.prenda < b.prenda) return -1;
        if (a.prenda > b.prenda) return 1;
        if (a.talla < b.talla) return -1;
        if (a.talla > b.talla) return 1;
        return 0;
      });

      setReportData(reporteFinal);

      // 7. Preparar datos para CSV (con formato simple)
      const dataParaCsv = reporteFinal.map(r => ({
        COLEGIO: r.colegio,
        PRENDA: r.prenda,
        TALLA: r.talla,
        CANTIDAD: r.cantidadTotal,
        REFERENCIAS: r.referencias,
        OBSERVACIONES: r.observaciones,
        PEDIDOS: r.pedidos
      }));
      setCsvData(dataParaCsv);

    } catch (error) {
      console.error('Error al generar el reporte de corte:', error);
      alert('Error al generar el reporte: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getCsvFileName = () => {
    const startStr = formatDateForInput(startDate).replace(/-/g, '');
    const endStr = formatDateForInput(endDate).replace(/-/g, '');
    return `ReporteCorte_${startStr}_${endStr}.csv`;
  };

  return (
    <div>
      {/* --- Encabezado y Filtros --- */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reporte de Corte (Producción)</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Total de prendas agrupadas (solo items "En Producción").</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {csvData.length > 0 && (
            <CSVLink
              data={csvData}
              filename={getCsvFileName()}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <FileDown size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Exportar a Excel</span>
              <span className="sm:hidden">Exportar</span>
            </CSVLink>
          )}
          <button
            onClick={handlePrint}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#D50565' }}
          >
            <Printer size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden sm:inline">Imprimir</span>
            <span className="sm:hidden">Imprimir</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          {/* Fecha Inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio (Pedido)</label>
            <input
              type="date"
              value={formatDateForInput(startDate)}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin (Pedido)</label>
            <input
              type="date"
              value={formatDateForInput(endDate)}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
            />
          </div>

          {/* Filtro Estado */}
          <div className="sm:col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado del Pedido</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
            >
              <option value="Pendientes">Pendientes (No Entregados)</option>
              <option value="Todos">Todos (Incluir Entregados)</option>
            </select>
          </div>

          {/* Botón Generar */}
          <button
            onClick={handleFetchReporteCorte}
            disabled={loading}
            className="w-full px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white rounded-lg font-medium shadow-md transition-all disabled:opacity-50 sm:col-span-2 md:col-span-1"
            style={{ backgroundColor: '#D50565' }}
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
        </div>
      </div>

      {/* --- Contenido del Reporte (Sección Imprimible) --- */}
      <div id="reporte-corte-print">
        {loading && (
          <div className="text-center py-20">
            <p className="text-gray-600">Generando reporte...</p>
          </div>
        )}

        {!loading && reportData.length === 0 && (
          <div className="text-center py-20 bg-white rounded-lg shadow-md">
            <p className="text-gray-600">No se encontraron ítems "En Producción" para este rango de fechas.</p>
          </div>
        )}

        {reportData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                Reporte de Corte Agrupado ({reportData.length} filas)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Mostrando pedidos de {formatDateForInput(startDate)} a {formatDateForInput(endDate)}
              </p>
            </div>

            {/* Vista de Tarjetas - Solo Móvil */}
            <div className="md:hidden divide-y divide-gray-200">
              {reportData.map((item, index) => (
                <div key={index} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-sm">{item.colegio}</p>
                      <p className="text-sm text-gray-700">{item.prenda} - Talla {item.talla}</p>
                    </div>
                    <span className="text-2xl font-bold ml-2" style={{color: '#D50565'}}>
                      {item.cantidadTotal}
                    </span>
                  </div>
                  {item.observaciones && (
                    <p className="text-xs text-gray-600 mb-2">{item.observaciones}</p>
                  )}
                  <div className="text-xs text-gray-500 space-y-1 print:hidden">
                    <p>Ref: {item.referencias}</p>
                    <p>Pedidos: {item.pedidos}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista de Tabla - Solo Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Colegio</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prenda</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Talla</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad Total</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase print:hidden">Ref. / Pedidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 whitespace-nowrap">{item.colegio}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{item.prenda}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{item.talla}</td>
                      <td className="px-3 py-2 text-center text-lg font-bold text-pink-600" style={{color: '#D50565'}}>
                        {item.cantidadTotal}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">{item.observaciones}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 print:hidden">
                        <div>Ref: {item.referencias}</div>
                        <div>Pedidos: {item.pedidos}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- Estilos de Impresión --- */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #reporte-corte-print, #reporte-corte-print * {
            visibility: visible;
          }
          #reporte-corte-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .print\:hidden {
            display: none;
          }
          table {
            font-size: 10px; /* Más pequeño para que quepa */
          }
          td, th {
            padding: 6px 4px; /* Menos padding */
          }
        }
      `}</style>
    </div>
  );
};

export default ReporteCorte;
