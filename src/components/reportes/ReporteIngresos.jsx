import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import {
  Download,
  Calendar,
  TrendingUp,
  Filter,
  DollarSign,
  Wallet,
  CreditCard
} from 'lucide-react';
import * as XLSX from 'xlsx';

const ReporteIngresos = () => {
  // Estados para filtros
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [metodoPago, setMetodoPago] = useState('todos');
  const [fuenteIngreso, setFuenteIngreso] = useState('todas'); // todas, pos, pedidos, apartados, pedidosB2B
  const [agrupacion, setAgrupacion] = useState('ninguna'); // ninguna, fecha, metodoPago, fuente

  // Estados para datos
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const formatDateForInput = (date) => {
    if (!date) return '';
    const localDate = new Date(date.getTime());
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    return localDate.toISOString().split('T')[0];
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const setPresetDate = (preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (preset) {
      case 'hoy':
        setStartDate(today);
        setEndDate(today);
        break;
      case 'ayer':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(yesterday);
        setEndDate(yesterday);
        break;
      case 'semana':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setStartDate(weekAgo);
        setEndDate(today);
        break;
      case 'mes':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setStartDate(monthAgo);
        setEndDate(today);
        break;
    }
  };

  const generarReporte = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(start);
      const endTimestamp = Timestamp.fromDate(end);

      // Consultar TRANSACCIONES (no documentos de venta/pedido)
      // Esto refleja el flujo de caja real por fecha de transacción
      const transQuery = query(
        collection(db, 'transactions'),
        where('fecha', '>=', startTimestamp),
        where('fecha', '<=', endTimestamp),
        orderBy('fecha', 'desc')
      );

      const transSnap = await getDocs(transQuery);

      // También consultar transacciones B2B (colección separada)
      const transB2BQuery = query(
        collection(db, 'transactions_b2b'),
        where('fecha', '>=', startTimestamp),
        where('fecha', '<=', endTimestamp),
        orderBy('fecha', 'desc')
      );

      const transB2BSnap = await getDocs(transB2BQuery);

      let todosLosIngresos = [];

      transSnap.forEach(doc => {
        const trans = doc.data();

        // FILTRAR solo transacciones de INGRESO a caja
        // Excluir anuladas
        if (trans.anulada === true) return;

        // Excluir pendientes (no han ingresado dinero todavía)
        if (trans.metodoPago === 'Pendiente') return;

        // Excluir entradas de satélite que no afectan caja
        if (trans.tipo === 'entrada_satelite' && trans.afectaCaja !== true) return;

        // Solo considerar transacciones de ingreso (monto positivo)
        if (trans.monto <= 0) return;

        // Determinar la fuente del ingreso
        let fuente = 'Otro';
        if (trans.tipo === 'venta') {
          fuente = 'POS';
        } else if (trans.tipo === 'abono_pedido') {
          fuente = 'Pedido';
        } else if (trans.tipo === 'abono_apartado') {
          fuente = 'Apartado';
        } else if (trans.tipo === 'abono_pedido_b2b') {
          fuente = 'Pedido B2B';
        } else if (trans.tipo === 'entrada_satelite' && trans.afectaCaja === true) {
          fuente = 'Entrada Satélite';
        } else {
          // Otros ingresos positivos
          return;
        }

        // Aplicar filtro de fuente
        if (fuenteIngreso !== 'todas') {
          if (fuenteIngreso === 'pos' && fuente !== 'POS') return;
          if (fuenteIngreso === 'pedidos' && fuente !== 'Pedido') return;
          if (fuenteIngreso === 'apartados' && fuente !== 'Apartado') return;
          if (fuenteIngreso === 'pedidosB2B' && fuente !== 'Pedido B2B') return;
        }

        // Aplicar filtro de método de pago
        if (metodoPago !== 'todos' && trans.metodoPago !== metodoPago) return;

        todosLosIngresos.push({
          id: doc.id,
          fecha: trans.fecha.toDate(),
          fuente: fuente,
          tipo: trans.tipo,
          monto: trans.monto,
          metodoPago: trans.metodoPago || 'Efectivo',
          descripcion: trans.descripcion || '',
          numeroDocumento: trans.numeroFactura || trans.numeroPedido || trans.numeroApartado || 0,
          clienteNombre: trans.clienteNombre || 'N/A'
        });
      });

      // Procesar transacciones B2B (de la colección separada)
      transB2BSnap.forEach(doc => {
        const trans = doc.data();

        // Excluir anuladas
        if (trans.anulada === true) return;

        // Solo considerar transacciones de ingreso (monto positivo)
        if (trans.monto <= 0) return;

        // Aplicar filtro de fuente
        if (fuenteIngreso !== 'todas' && fuenteIngreso !== 'pedidosB2B') return;

        // Aplicar filtro de método de pago
        if (metodoPago !== 'todos' && trans.metodoPago !== metodoPago) return;

        todosLosIngresos.push({
          id: doc.id,
          fecha: trans.fecha.toDate(),
          fuente: 'Pedido B2B',
          tipo: trans.tipo,
          monto: trans.monto,
          metodoPago: trans.metodoPago || 'No especificado',
          descripcion: trans.notas || `Abono pedido #${trans.numeroPedido || 0}`,
          numeroDocumento: trans.numeroPedido || 0,
          clienteNombre: trans.clienteNombre || 'N/A'
        });
      });

      // Agrupar según selección
      let datosAgrupados = [];

      if (agrupacion === 'ninguna') {
        datosAgrupados = todosLosIngresos;
      } else {
        const grupos = {};

        todosLosIngresos.forEach(ingreso => {
          let clave = '';

          switch (agrupacion) {
            case 'fecha':
              clave = ingreso.fecha.toISOString().split('T')[0];
              break;
            case 'metodoPago':
              clave = ingreso.metodoPago;
              break;
            case 'fuente':
              clave = ingreso.fuente;
              break;
            default:
              clave = 'General';
          }

          if (!grupos[clave]) {
            grupos[clave] = {
              clave,
              nombre: agrupacion === 'fecha' ? new Date(clave).toLocaleDateString('es-CO') :
                      clave,
              totalIngresos: 0,
              cantidadTransacciones: 0,
              ingresos: []
            };
          }

          grupos[clave].totalIngresos += ingreso.monto;
          grupos[clave].cantidadTransacciones += 1;
          grupos[clave].ingresos.push(ingreso);
        });

        datosAgrupados = Object.values(grupos);

        // Ordenar por total de ingresos descendente
        datosAgrupados.sort((a, b) => b.totalIngresos - a.totalIngresos);
      }

      // Calcular totales generales
      const totales = {
        totalIngresos: todosLosIngresos.reduce((sum, i) => sum + i.monto, 0),
        cantidadTransacciones: todosLosIngresos.length
      };

      // Desglose por método de pago
      const porMetodo = {};
      todosLosIngresos.forEach(i => {
        const metodo = i.metodoPago;
        if (!porMetodo[metodo]) {
          porMetodo[metodo] = { total: 0, cantidad: 0 };
        }
        porMetodo[metodo].total += i.monto;
        porMetodo[metodo].cantidad += 1;
      });

      // Desglose por fuente
      const porFuente = {};
      todosLosIngresos.forEach(i => {
        const fuente = i.fuente;
        if (!porFuente[fuente]) {
          porFuente[fuente] = { total: 0, cantidad: 0 };
        }
        porFuente[fuente].total += i.monto;
        porFuente[fuente].cantidad += 1;
      });

      setReportData({
        datos: datosAgrupados,
        totales,
        porMetodo,
        porFuente
      });

    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('Error al generar reporte de ingresos');
    } finally {
      setLoading(false);
    }
  };

  const exportarAExcel = () => {
    if (!reportData || !reportData.datos.length) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      let dataParaExcel = [];

      if (agrupacion === 'ninguna') {
        // Exportar detalle completo
        dataParaExcel = reportData.datos.map(ingreso => ({
          'Fecha': ingreso.fecha.toLocaleDateString('es-CO'),
          'Hora': ingreso.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          'Fuente': ingreso.fuente,
          'No. Documento': ingreso.numeroDocumento,
          'Cliente': ingreso.clienteNombre,
          'Descripción': ingreso.descripcion,
          'Método de Pago': ingreso.metodoPago,
          'Monto': ingreso.monto
        }));
      } else {
        // Exportar datos agrupados
        dataParaExcel = reportData.datos.map(grupo => ({
          'Grupo': grupo.nombre,
          'Cantidad Transacciones': grupo.cantidadTransacciones,
          'Total Ingresos': grupo.totalIngresos
        }));
      }

      // Agregar fila de totales
      if (agrupacion === 'ninguna') {
        dataParaExcel.push({
          'Fecha': '',
          'Hora': '',
          'Fuente': '',
          'No. Documento': '',
          'Cliente': '',
          'Descripción': 'TOTALES',
          'Método de Pago': '',
          'Monto': reportData.totales.totalIngresos
        });
      } else {
        dataParaExcel.push({
          'Grupo': 'TOTALES',
          'Cantidad Transacciones': reportData.totales.cantidadTransacciones,
          'Total Ingresos': reportData.totales.totalIngresos
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Ingresos');

      const fileName = `Reporte_Ingresos_${formatDateForInput(startDate)}_${formatDateForInput(endDate)}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      alert('Reporte exportado exitosamente');
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al exportar el reporte');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <DollarSign size={28} style={{ color: '#EA5C2E' }} />
          Reporte de Ingresos
        </h1>
        <p className="text-gray-600 mt-1">Visualiza el flujo de caja real por fecha de ingreso</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Filter size={20} style={{ color: '#EA5C2E' }} />
          Filtros
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Fechas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={formatDateForInput(startDate)}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-');
                setStartDate(new Date(year, month - 1, day));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={formatDateForInput(endDate)}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-');
                setEndDate(new Date(year, month - 1, day));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Presets de fecha */}
          <div className="flex flex-wrap gap-2 items-end">
            <button
              onClick={() => setPresetDate('hoy')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Hoy
            </button>
            <button
              onClick={() => setPresetDate('semana')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              7 días
            </button>
            <button
              onClick={() => setPresetDate('mes')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              30 días
            </button>
          </div>

          {/* Fuente de ingreso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuente de Ingreso
            </label>
            <select
              value={fuenteIngreso}
              onChange={(e) => setFuenteIngreso(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="todas">Todas las fuentes</option>
              <option value="pos">POS (Ventas Directas)</option>
              <option value="pedidos">Abonos a Pedidos</option>
              <option value="apartados">Abonos a Apartados</option>
              <option value="pedidosB2B">Abonos a Pedidos B2B</option>
            </select>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de Pago
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="todos">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Nequi">Nequi</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>

          {/* Agrupación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agrupar Por
            </label>
            <select
              value={agrupacion}
              onChange={(e) => setAgrupacion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ninguna">Sin agrupar (Detalle)</option>
              <option value="fecha">Por Fecha</option>
              <option value="metodoPago">Por Método de Pago</option>
              <option value="fuente">Por Fuente</option>
            </select>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={generarReporte}
            disabled={loading}
            className="flex-1 px-6 py-3 text-white rounded-lg font-medium shadow-md transition-all disabled:opacity-50"
            style={{ backgroundColor: '#EA5C2E' }}
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
          <button
            onClick={exportarAExcel}
            disabled={!reportData || loading}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium shadow-md hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* Resultados */}
      {loading && (
        <div className="text-center py-20">
          <p className="text-gray-600">Generando reporte...</p>
        </div>
      )}

      {!loading && !reportData && (
        <div className="text-center py-20 bg-white rounded-lg shadow-md">
          <p className="text-gray-600">Configura los filtros y haz clic en "Generar Reporte"</p>
        </div>
      )}

      {!loading && reportData && (
        <>
          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Ingresos</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(reportData.totales.totalIngresos)}
                  </p>
                </div>
                <DollarSign size={40} className="opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Transacciones</p>
                  <p className="text-3xl font-bold mt-1">
                    {reportData.totales.cantidadTransacciones}
                  </p>
                </div>
                <TrendingUp size={40} className="opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Promedio por Transacción</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(
                      reportData.totales.cantidadTransacciones > 0
                        ? reportData.totales.totalIngresos / reportData.totales.cantidadTransacciones
                        : 0
                    )}
                  </p>
                </div>
                <Calendar size={40} className="opacity-80" />
              </div>
            </div>
          </div>

          {/* Desgloses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Desglose por Método de Pago */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2" style={{ backgroundColor: '#FFF1E5' }}>
                <Wallet size={20} style={{ color: '#EA5C2E' }} />
                <h2 className="text-lg font-semibold text-gray-800">Por Método de Pago</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {Object.keys(reportData.porMetodo).sort().map(metodo => (
                  <div key={metodo} className="p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">{metodo}</span>
                      <span className="font-bold text-gray-800">
                        {formatCurrency(reportData.porMetodo[metodo].total)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {reportData.porMetodo[metodo].cantidad} transacción(es)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desglose por Fuente */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b flex items-center gap-2" style={{ backgroundColor: '#E8F5E9' }}>
                <CreditCard size={20} className="text-green-600" />
                <h2 className="text-lg font-semibold text-gray-800">Por Fuente</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {Object.keys(reportData.porFuente).sort().map(fuente => (
                  <div key={fuente} className="p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">{fuente}</span>
                      <span className="font-bold text-gray-800">
                        {formatCurrency(reportData.porFuente[fuente].total)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {reportData.porFuente[fuente].cantidad} transacción(es)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla de Resultados */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                Detalle de Ingresos ({reportData.datos.length} {agrupacion === 'ninguna' ? 'transacción(es)' : 'grupo(s)'})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {agrupacion === 'ninguna' ? (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha / Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Doc</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {agrupacion === 'fecha' ? 'Fecha' :
                           agrupacion === 'metodoPago' ? 'Método de Pago' :
                           agrupacion === 'fuente' ? 'Fuente' : 'Grupo'}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transacciones</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Ingresos</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {agrupacion === 'ninguna' ? (
                    reportData.datos.map((ingreso, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {ingreso.fecha.toLocaleDateString('es-CO')}
                          <span className="text-gray-500 ml-2">
                            {ingreso.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ingreso.fuente === 'POS' ? 'bg-blue-100 text-blue-800' :
                            ingreso.fuente === 'Pedido' ? 'bg-purple-100 text-purple-800' :
                            ingreso.fuente === 'Apartado' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {ingreso.fuente}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ingreso.numeroDocumento || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{ingreso.clienteNombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ingreso.descripcion}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{ingreso.metodoPago}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                          {formatCurrency(ingreso.monto)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    reportData.datos.map((grupo, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{grupo.nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{grupo.cantidadTransacciones}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                          {formatCurrency(grupo.totalIngresos)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    {agrupacion === 'ninguna' ? (
                      <>
                        <td colSpan="6" className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          TOTAL:
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">
                          {formatCurrency(reportData.totales.totalIngresos)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                          {reportData.totales.cantidadTransacciones}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">
                          {formatCurrency(reportData.totales.totalIngresos)}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReporteIngresos;
