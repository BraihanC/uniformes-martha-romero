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
  // Opciones: 'En Producción', 'Parcialmente Listo', 'Listo para Entrega', 'Todos los Pendientes', 'Todos'
  const [filtroEstado, setFiltroEstado] = useState('Todos los Pendientes');

  // Filtros de búsqueda
  const [searchPrenda, setSearchPrenda] = useState('');
  const [searchColegio, setSearchColegio] = useState('');
  const [searchTalla, setSearchTalla] = useState('');
  const [searchReferencia, setSearchReferencia] = useState('');

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

      // 3. Aplicar filtro de estado a nivel de pedido
      // Solo filtramos pedidos entregados si el usuario selecciona "Todos"
      if (filtroEstado !== 'Todos') {
        // Para cualquier otro filtro, excluir pedidos completamente entregados
        q = query(q, where('estadoGeneral', '!=', 'Entregado'));
      }

      const querySnapshot = await getDocs(q);
      const pedidos = querySnapshot.docs.map(doc => doc.data());

      // 4. Procesar y Aplanar los datos
      const itemsAplanados = [];
      pedidos.forEach(pedido => {
        // Excluir pedidos anulados
        if (pedido.anulado === true || pedido.estadoGeneral === 'Anulado') {
          return;
        }

        // Filtrar items según el estado seleccionado
        let itemsParaCorte = [];

        if (filtroEstado === 'En Producción') {
          // Solo items en producción
          itemsParaCorte = pedido.items.filter(item =>
            !item.anulado && item.estadoItem === 'En Producción'
          );
        } else if (filtroEstado === 'Parcialmente Listo') {
          // Solo items parcialmente listos
          itemsParaCorte = pedido.items.filter(item =>
            !item.anulado && item.estadoItem === 'Parcialmente Listo'
          );
        } else if (filtroEstado === 'Listo para Entrega') {
          // Solo items listos para entrega
          itemsParaCorte = pedido.items.filter(item =>
            !item.anulado && item.estadoItem === 'Listo para Entrega'
          );
        } else if (filtroEstado === 'Todos los Pendientes') {
          // Todo lo que NO esté entregado
          itemsParaCorte = pedido.items.filter(item =>
            !item.anulado && item.estadoItem !== 'Entregado'
          );
        } else {
          // 'Todos' - Incluir todo (incluso entregados)
          itemsParaCorte = pedido.items.filter(item => !item.anulado);
        }

        itemsParaCorte.forEach(item => {
          // Usar el colegio guardado directamente en el pedido
          const colegioNombre = pedido.colegioNombre || 'General (Sin Colegio)';

          // Para items parcialmente listos, calcular cantidad pendiente
          let cantidadParaReporte = item.cantidad;
          let detalleEstado = '';

          if (item.estadoItem === 'Parcialmente Listo') {
            const cantidadLista = item.cantidadLista || 0;
            const cantidadEntregada = item.cantidadEntregada || 0;
            const cantidadPendiente = item.cantidad - cantidadLista - cantidadEntregada;

            // Reportar solo la cantidad pendiente
            cantidadParaReporte = cantidadPendiente;
            detalleEstado = ` (${cantidadLista} listas, ${cantidadPendiente} pendientes)`;
          }

          itemsAplanados.push({
            colegio: colegioNombre,
            prenda: item.nombre,
            referencia: item.referencia || '',
            talla: item.talla || 'Única',
            cantidad: cantidadParaReporte,
            estadoItem: item.estadoItem,
            detalleEstado: detalleEstado,
            observaciones: pedido.observaciones || '',
            pedidoNum: pedido.numeroPedido || 'N/A',
            clienteNombre: pedido.clienteNombre || 'Sin nombre'
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
            pedidos: new Set(),
            clientes: new Set(),
            estados: new Set(),
            detallesEstado: []
          };
        }

        // Sumamos la cantidad y añadimos las referencias
        acc[key].cantidadTotal += item.cantidad;
        acc[key].referencias.add(item.referencia);
        acc[key].pedidos.add(item.pedidoNum);
        acc[key].clientes.add(item.clienteNombre);
        acc[key].estados.add(item.estadoItem);
        if (item.detalleEstado) {
          acc[key].detallesEstado.push(item.detalleEstado);
        }

        return acc;
      }, {});

      // 6. Convertir el objeto agrupado en un Array y formatear
      const reporteFinal = Object.values(agrupado).map(g => ({
        ...g,
        referencias: Array.from(g.referencias).join(', '),
        pedidos: Array.from(g.pedidos).join(', '),
        clientes: Array.from(g.clientes).join(', '),
        estadosString: Array.from(g.estados).join(', '),
        detalleEstadoString: g.detallesEstado.join('; ')
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
        ESTADOS: r.estadosString,
        CLIENTES: r.clientes,
        PEDIDOS: r.pedidos,
        OBSERVACIONES: r.observaciones
      }));
      setCsvData(dataParaCsv);

    } catch (error) {
      console.error('Error al generar el reporte de corte:', error);
      alert('Error al generar el reporte: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar datos del reporte según los criterios de búsqueda
  const filteredReportData = reportData.filter(item => {
    const matchPrenda = !searchPrenda || item.prenda.toLowerCase().includes(searchPrenda.toLowerCase());
    const matchColegio = !searchColegio || item.colegio.toLowerCase().includes(searchColegio.toLowerCase());
    const matchTalla = !searchTalla || item.talla.toLowerCase().includes(searchTalla.toLowerCase());
    const matchReferencia = !searchReferencia || item.referencias.toLowerCase().includes(searchReferencia.toLowerCase());

    return matchPrenda && matchColegio && matchTalla && matchReferencia;
  });

  // Calcular total de cantidad filtrada
  const totalCantidadFiltrada = filteredReportData.reduce((sum, item) => sum + item.cantidadTotal, 0);

  const handlePrint = () => {
    window.print();
  };

  const getCsvFileName = () => {
    const startStr = formatDateForInput(startDate).replace(/-/g, '');
    const endStr = formatDateForInput(endDate).replace(/-/g, '');
    return `ReporteCorte_${startStr}_${endStr}.csv`;
  };

  const handleLimpiarFiltros = () => {
    setSearchPrenda('');
    setSearchColegio('');
    setSearchTalla('');
    setSearchReferencia('');
  };

  return (
    <div>
      {/* --- Encabezado y Filtros --- */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reporte de Corte (Producción)</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Total de prendas agrupadas por estado seleccionado.</p>
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
              onChange={(e) => {
                // Crear fecha en zona horaria local evitando el problema de UTC
                const [year, month, day] = e.target.value.split('-');
                setStartDate(new Date(year, month - 1, day));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin (Pedido)</label>
            <input
              type="date"
              value={formatDateForInput(endDate)}
              onChange={(e) => {
                // Crear fecha en zona horaria local evitando el problema de UTC
                const [year, month, day] = e.target.value.split('-');
                setEndDate(new Date(year, month - 1, day));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
            />
          </div>

          {/* Filtro Estado */}
          <div className="sm:col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
            >
              <option value="Todos los Pendientes">Todos los Pendientes</option>
              <option value="En Producción">🔧 En Producción</option>
              <option value="Parcialmente Listo">⏳ Parcialmente Listo</option>
              <option value="Listo para Entrega">✅ Listo para Entrega</option>
              <option value="Todos">📋 Todos (Incluir Entregados)</option>
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

      {/* --- Filtros de Búsqueda (solo si hay datos) --- */}
      {reportData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 print:hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-2 sm:mb-0">Filtrar Resultados</h3>
            <button
              onClick={handleLimpiarFiltros}
              className="text-sm text-gray-600 hover:text-pink-600 underline"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Buscar por Prenda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Prenda</label>
              <input
                type="text"
                value={searchPrenda}
                onChange={(e) => setSearchPrenda(e.target.value)}
                placeholder="ej. CHAQUETA MA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
            </div>

            {/* Buscar por Colegio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Colegio</label>
              <input
                type="text"
                value={searchColegio}
                onChange={(e) => setSearchColegio(e.target.value)}
                placeholder="ej. Manuel Aya"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
            </div>

            {/* Buscar por Talla */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Talla</label>
              <input
                type="text"
                value={searchTalla}
                onChange={(e) => setSearchTalla(e.target.value)}
                placeholder="ej. 12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
            </div>

            {/* Buscar por Referencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Referencia</label>
              <input
                type="text"
                value={searchReferencia}
                onChange={(e) => setSearchReferencia(e.target.value)}
                placeholder="ej. MA003TD"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
            </div>
          </div>

          {/* Resumen de Filtrado */}
          {(searchPrenda || searchColegio || searchTalla || searchReferencia) && (
            <div className="mt-3 p-3 bg-pink-50 rounded-lg border border-pink-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Resultados filtrados:</span> {filteredReportData.length} filas
                <span className="ml-2">|</span>
                <span className="ml-2 font-semibold">Total unidades:</span> {totalCantidadFiltrada}
              </p>
            </div>
          )}
        </div>
      )}

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
            {/* Encabezado del reporte (solo visible al imprimir) */}
            <div className="hidden print:block border-b-2 border-gray-800 pb-3 mb-4">
              <h1 className="text-2xl font-bold text-gray-900">UNIFORMES MARTHA ROMERO</h1>
              <h2 className="text-xl font-semibold text-gray-700 mt-1">Reporte de Corte (Producción)</h2>
              <p className="text-sm text-gray-600 mt-2">
                Período: {startDate.toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })} - {endDate.toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-sm text-gray-600">
                Estado: {filtroEstado} | Total de filas: {reportData.length}
              </p>
              <p className="text-sm text-gray-600">
                Generado: {new Date().toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div className="p-4 border-b print:hidden">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                Reporte de Corte Agrupado ({filteredReportData.length} de {reportData.length} filas)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Mostrando pedidos de {formatDateForInput(startDate)} a {formatDateForInput(endDate)}
                {(searchPrenda || searchColegio || searchTalla || searchReferencia) && (
                  <span className="ml-2 text-pink-600 font-medium">- Total filtrado: {totalCantidadFiltrada} unidades</span>
                )}
              </p>
            </div>

            {/* Vista de Tarjetas - Solo Móvil */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredReportData.map((item, index) => (
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
                  <div className="mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.estadosString.includes('En Producción') ? 'bg-blue-100 text-blue-800' :
                      item.estadosString.includes('Parcialmente Listo') ? 'bg-orange-100 text-orange-800' :
                      item.estadosString.includes('Listo para Entrega') ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.estadosString}
                    </span>
                  </div>
                  {item.clientes && (
                    <p className="text-xs text-gray-700 mb-1"><span className="font-semibold">Clientes:</span> {item.clientes}</p>
                  )}
                  {item.observaciones && (
                    <p className="text-xs text-gray-600 mb-2"><span className="font-semibold">Obs:</span> {item.observaciones}</p>
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
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clientes</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase print:hidden">Ref. / Pedidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReportData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-800 whitespace-nowrap">{item.colegio}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{item.prenda}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{item.talla}</td>
                      <td className="px-3 py-2 text-center text-lg font-bold text-pink-600" style={{color: '#D50565'}}>
                        {item.cantidadTotal}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.estadosString.includes('En Producción') ? 'bg-blue-100 text-blue-800' :
                          item.estadosString.includes('Parcialmente Listo') ? 'bg-orange-100 text-orange-800' :
                          item.estadosString.includes('Listo para Entrega') ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.estadosString}
                        </span>
                        {item.detalleEstadoString && (
                          <div className="text-xs text-gray-500 mt-1">{item.detalleEstadoString}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 max-w-xs">
                        <div className="truncate" title={item.clientes}>{item.clientes}</div>
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
          /* Configuración de página tamaño carta */
          @page {
            size: letter;
            margin: 0.5in;
          }

          /* Ocultar todo excepto el reporte */
          body * {
            visibility: hidden;
          }

          #reporte-corte-print,
          #reporte-corte-print * {
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

          .print\\:hidden {
            display: none !important;
          }

          /* Mostrar elementos con print:block */
          .print\\:block {
            display: block !important;
          }

          /* Reducir tamaños de fuente */
          #reporte-corte-print {
            font-size: 9px;
          }

          #reporte-corte-print h1 {
            font-size: 16px;
            margin-bottom: 4px;
          }

          #reporte-corte-print h2 {
            font-size: 12px;
            margin-bottom: 6px;
          }

          #reporte-corte-print .text-2xl {
            font-size: 16px !important;
          }

          #reporte-corte-print .text-xl {
            font-size: 14px !important;
          }

          #reporte-corte-print .text-lg {
            font-size: 12px !important;
          }

          #reporte-corte-print .text-base {
            font-size: 10px !important;
          }

          #reporte-corte-print .text-sm {
            font-size: 9px !important;
          }

          #reporte-corte-print .text-xs {
            font-size: 8px !important;
          }

          /* Reducir espaciados */
          #reporte-corte-print .p-4 {
            padding: 6px !important;
          }

          #reporte-corte-print .p-3 {
            padding: 4px !important;
          }

          #reporte-corte-print .px-3 {
            padding-left: 4px !important;
            padding-right: 4px !important;
          }

          #reporte-corte-print .py-2 {
            padding-top: 3px !important;
            padding-bottom: 3px !important;
          }

          #reporte-corte-print .mb-4 {
            margin-bottom: 8px !important;
          }

          #reporte-corte-print .mt-2 {
            margin-top: 4px !important;
          }

          #reporte-corte-print .mt-1 {
            margin-top: 2px !important;
          }

          /* Tablas más compactas */
          #reporte-corte-print table {
            font-size: 8px;
            width: 100%;
          }

          #reporte-corte-print th,
          #reporte-corte-print td {
            padding: 3px 4px !important;
            font-size: 8px !important;
          }

          #reporte-corte-print th {
            font-size: 7px !important;
            text-transform: uppercase;
          }

          /* Ajustar bordes y sombras para impresión */
          #reporte-corte-print .shadow-md {
            box-shadow: none !important;
            border: 1px solid #e5e7eb;
          }

          #reporte-corte-print .rounded-lg {
            border-radius: 4px !important;
          }

          /* Evitar saltos de página dentro de elementos */
          #reporte-corte-print .bg-white {
            page-break-inside: avoid;
          }

          /* Optimizar el espacio del encabezado */
          #reporte-corte-print .border-b-2 {
            padding-bottom: 8px !important;
            margin-bottom: 10px !important;
            border-bottom: 2px solid #333 !important;
          }

          /* Hacer que la tabla use todo el ancho */
          #reporte-corte-print .overflow-x-auto {
            overflow: visible !important;
          }

          /* Ajustar cantidad para que resalte */
          #reporte-corte-print .text-pink-600 {
            font-size: 11px !important;
            font-weight: bold;
          }

          /* Espaciado entre filas */
          #reporte-corte-print tbody tr {
            border-bottom: 1px solid #e5e7eb;
          }

          /* Encabezado de tabla con fondo */
          #reporte-corte-print thead {
            background-color: #f9fafb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default ReporteCorte;
