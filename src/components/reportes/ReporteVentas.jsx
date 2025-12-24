import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import {
  Download,
  Calendar,
  TrendingUp,
  Filter,
  Package,
  Users,
  DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';

const ReporteVentas = () => {
  // Estados para filtros
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [fuenteVenta, setFuenteVenta] = useState('todas'); // todas, pos, pedidos, pedidosB2B, apartados
  const [clienteId, setClienteId] = useState('');
  const [productoRef, setProductoRef] = useState('');
  const [metodoPago, setMetodoPago] = useState('todos');
  const [colegioId, setColegioId] = useState('');
  const [agrupacion, setAgrupacion] = useState('ninguna'); // ninguna, producto, cliente, fecha, metodoPago

  // Estados para datos
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [colegios, setColegios] = useState([]);

  // Cargar catálogos
  useEffect(() => {
    loadCatalogos();
  }, []);

  const loadCatalogos = async () => {
    try {
      // Cargar clientes
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const clientesData = clientesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientes(clientesData);

      // Cargar productos
      const productosSnap = await getDocs(collection(db, 'products'));
      const productosData = productosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProductos(productosData);

      // Cargar colegios
      const colegiosSnap = await getDocs(collection(db, 'colegios'));
      const colegiosData = colegiosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setColegios(colegiosData);
    } catch (error) {
      console.error('Error al cargar catálogos:', error);
    }
  };

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

      let todasLasVentas = [];

      // 1. VENTAS POS (sales)
      if (fuenteVenta === 'todas' || fuenteVenta === 'pos') {
        const salesQuery = query(
          collection(db, 'sales'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        const salesSnap = await getDocs(salesQuery);

        salesSnap.forEach(doc => {
          const sale = doc.data();
          sale.items?.forEach(item => {
            const subtotalItem = item.subtotal || 0;
            todasLasVentas.push({
              fecha: sale.createdAt.toDate(),
              fuente: 'POS',
              numeroDocumento: sale.numeroFactura || 0,
              clienteId: sale.clienteId || '',
              clienteNombre: sale.clienteNombre || 'Cliente General',
              productoId: item.productoId || '',
              productoNombre: item.nombre || '',
              referencia: item.referencia || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precioUnitario || 0,
              subtotal: subtotalItem, // Total de venta
              montoRecibido: subtotalItem, // POS: se recibe todo de una vez
              metodoPago: sale.metodoPago || 'Efectivo',
              colegioId: '',
              colegioNombre: ''
            });
          });
        });
      }

      // 2. PEDIDOS (pedidos)
      if (fuenteVenta === 'todas' || fuenteVenta === 'pedidos') {
        const pedidosQuery = query(
          collection(db, 'pedidos'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        const pedidosSnap = await getDocs(pedidosQuery);

        pedidosSnap.forEach(doc => {
          const pedido = doc.data();
          // Calcular proporción abonada
          const totalPedido = pedido.total || 0;
          const totalAbonado = pedido.totalAbonado || 0;
          const proporcionAbonada = totalPedido > 0 ? totalAbonado / totalPedido : 0;

          pedido.items?.forEach(item => {
            const subtotalItem = item.subtotal || 0;
            const montoRecibidoItem = subtotalItem * proporcionAbonada;

            todasLasVentas.push({
              fecha: pedido.createdAt.toDate(),
              fuente: 'Pedido',
              numeroDocumento: pedido.numeroPedido || 0,
              clienteId: pedido.clienteId || '',
              clienteNombre: pedido.clienteNombre || '',
              productoId: item.productoId || '',
              productoNombre: item.nombre || '',
              referencia: item.referencia || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precio || 0,
              subtotal: subtotalItem, // Total de venta
              montoRecibido: montoRecibidoItem, // Lo realmente cobrado
              metodoPago: pedido.abonos?.[0]?.metodoPago || 'N/A',
              colegioId: pedido.colegioId || '',
              colegioNombre: pedido.colegioNombre || ''
            });
          });
        });
      }

      // 3. PEDIDOS B2B
      if (fuenteVenta === 'todas' || fuenteVenta === 'pedidosB2B') {
        const pedidosB2BQuery = query(
          collection(db, 'pedidos_b2b'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        const pedidosB2BSnap = await getDocs(pedidosB2BQuery);

        pedidosB2BSnap.forEach(doc => {
          const pedido = doc.data();

          // Calcular proporción abonada
          const totalPedido = pedido.total || 0;
          const totalAbonado = pedido.abonos?.reduce((sum, abono) => sum + (abono.monto || 0), 0) || 0;
          const proporcionAbonada = totalPedido > 0 ? totalAbonado / totalPedido : 0;

          pedido.productos?.forEach(item => {
            const subtotalItem = item.subtotal || 0;
            const montoRecibidoItem = subtotalItem * proporcionAbonada;

            todasLasVentas.push({
              fecha: pedido.createdAt.toDate(),
              fuente: 'Pedido B2B',
              numeroDocumento: pedido.numeroPedido || 0,
              clienteId: pedido.clienteId || '',
              clienteNombre: pedido.clienteNombre || '',
              productoId: item.productoId || '',
              productoNombre: item.descripcion || '',
              referencia: item.codigo || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precioUnitario || 0,
              subtotal: subtotalItem, // Total de venta
              montoRecibido: montoRecibidoItem, // Lo realmente cobrado
              metodoPago: pedido.abonos?.[0]?.metodoPago || 'N/A',
              colegioId: '',
              colegioNombre: pedido.codigoColegio || ''
            });
          });
        });
      }

      // 4. APARTADOS COMPLETADOS
      if (fuenteVenta === 'todas' || fuenteVenta === 'apartados') {
        const apartadosQuery = query(
          collection(db, 'apartados'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        const apartadosSnap = await getDocs(apartadosQuery);

        apartadosSnap.forEach(doc => {
          const apartado = doc.data();

          // Calcular proporción abonada (incluir todos los apartados, no solo completados)
          const totalApartado = apartado.totalApartado || 0;
          const totalAbonado = apartado.totalAbonado || 0;
          const proporcionAbonada = totalApartado > 0 ? totalAbonado / totalApartado : 0;

          apartado.items?.forEach(item => {
            const subtotalItem = item.subtotal || 0;
            const montoRecibidoItem = subtotalItem * proporcionAbonada;

            todasLasVentas.push({
              fecha: apartado.createdAt.toDate(),
              fuente: 'Apartado',
              numeroDocumento: apartado.numeroApartado || 0,
              clienteId: apartado.clienteId || '',
              clienteNombre: apartado.clienteNombre || '',
              productoId: item.productoId || '',
              productoNombre: item.nombre || '',
              referencia: item.referencia || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precioUnitario || 0,
              subtotal: subtotalItem, // Total de venta
              montoRecibido: montoRecibidoItem, // Lo realmente cobrado
              metodoPago: apartado.historialAbonos?.[0]?.metodoPago || 'N/A',
              colegioId: apartado.colegioId || '',
              colegioNombre: apartado.colegioNombre || ''
            });
          });
        });
      }

      // Aplicar filtros adicionales
      let ventasFiltradas = todasLasVentas;

      if (clienteId) {
        ventasFiltradas = ventasFiltradas.filter(v => v.clienteId === clienteId);
      }

      if (productoRef) {
        ventasFiltradas = ventasFiltradas.filter(v =>
          v.referencia.toLowerCase().includes(productoRef.toLowerCase())
        );
      }

      if (metodoPago !== 'todos') {
        ventasFiltradas = ventasFiltradas.filter(v => v.metodoPago === metodoPago);
      }

      if (colegioId) {
        // Buscar el nombre del colegio seleccionado
        const colegioSeleccionado = colegios.find(c => c.id === colegioId);
        const nombreColegio = colegioSeleccionado?.nombre || '';
        const codigoColegio = colegioSeleccionado?.codigo || '';

        ventasFiltradas = ventasFiltradas.filter(v =>
          v.colegioId === colegioId ||
          v.colegioNombre === nombreColegio ||
          v.colegioNombre === codigoColegio
        );
      }

      // Obtener costos de productos
      const productosMap = {};
      productos.forEach(p => {
        productosMap[p.referencia] = {
          costoCompra: p.costoCompra || 0,
          costoSatelite: p.costoSatelite || 0
        };
      });

      // Calcular costos y utilidades
      ventasFiltradas = ventasFiltradas.map(venta => {
        const producto = productosMap[venta.referencia] || {};
        const costoUnitario = producto.costoCompra || producto.costoSatelite || 0;
        const costoTotal = costoUnitario * venta.cantidad;
        const utilidad = venta.subtotal - costoTotal;
        const margen = venta.subtotal > 0 ? (utilidad / venta.subtotal) * 100 : 0;

        return {
          ...venta,
          costoUnitario,
          costoTotal,
          utilidad,
          margen
        };
      });

      // Agrupar según selección
      let datosAgrupados = [];

      if (agrupacion === 'ninguna') {
        datosAgrupados = ventasFiltradas;
      } else {
        const grupos = {};

        ventasFiltradas.forEach(venta => {
          let clave = '';

          switch (agrupacion) {
            case 'producto':
              clave = venta.referencia;
              break;
            case 'cliente':
              clave = venta.clienteId || 'Sin Cliente';
              break;
            case 'fecha':
              clave = venta.fecha.toISOString().split('T')[0];
              break;
            case 'metodoPago':
              clave = venta.metodoPago;
              break;
            default:
              clave = 'General';
          }

          if (!grupos[clave]) {
            grupos[clave] = {
              clave,
              nombre: agrupacion === 'producto' ? venta.productoNombre :
                      agrupacion === 'cliente' ? venta.clienteNombre :
                      agrupacion === 'fecha' ? clave :
                      agrupacion === 'metodoPago' ? clave : 'General',
              referencia: venta.referencia,
              cantidad: 0,
              totalVentas: 0,
              montoRecibido: 0,
              costoTotal: 0,
              utilidad: 0,
              ventas: []
            };
          }

          grupos[clave].cantidad += venta.cantidad;
          grupos[clave].totalVentas += venta.subtotal;
          grupos[clave].montoRecibido += venta.montoRecibido;
          grupos[clave].costoTotal += venta.costoTotal;
          grupos[clave].utilidad += venta.utilidad;
          grupos[clave].ventas.push(venta);
        });

        datosAgrupados = Object.values(grupos).map(grupo => ({
          ...grupo,
          margen: grupo.totalVentas > 0 ? (grupo.utilidad / grupo.totalVentas) * 100 : 0
        }));

        // Ordenar por total de ventas descendente
        datosAgrupados.sort((a, b) => b.totalVentas - a.totalVentas);
      }

      // Calcular totales generales
      const totales = {
        cantidadTotal: ventasFiltradas.reduce((sum, v) => sum + v.cantidad, 0),
        ventasTotal: ventasFiltradas.reduce((sum, v) => sum + v.subtotal, 0),
        montoRecibidoTotal: ventasFiltradas.reduce((sum, v) => sum + v.montoRecibido, 0),
        costoTotal: ventasFiltradas.reduce((sum, v) => sum + v.costoTotal, 0),
        utilidadTotal: ventasFiltradas.reduce((sum, v) => sum + v.utilidad, 0),
        margenPromedio: 0
      };
      totales.margenPromedio = totales.ventasTotal > 0
        ? (totales.utilidadTotal / totales.ventasTotal) * 100
        : 0;

      setReportData({
        datos: datosAgrupados,
        totales
      });

    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('Error al generar reporte');
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
        dataParaExcel = reportData.datos.map(venta => ({
          'Fecha': venta.fecha.toLocaleDateString('es-CO'),
          'Fuente': venta.fuente,
          'No. Documento': venta.numeroDocumento,
          'Cliente': venta.clienteNombre,
          'Producto': venta.productoNombre,
          'Referencia': venta.referencia,
          'Talla': venta.talla,
          'Cantidad': venta.cantidad,
          'Precio Unit.': venta.precioUnitario,
          'Subtotal': venta.subtotal,
          'Recaudado': venta.montoRecibido,
          'Costo Unit.': venta.costoUnitario,
          'Costo Total': venta.costoTotal,
          'Utilidad': venta.utilidad,
          'Margen %': venta.margen.toFixed(2),
          'Método Pago': venta.metodoPago,
          'Colegio': venta.colegioNombre
        }));
      } else {
        // Exportar datos agrupados
        dataParaExcel = reportData.datos.map(grupo => ({
          'Grupo': grupo.nombre,
          'Cantidad Total': grupo.cantidad,
          'Total Ventas': grupo.totalVentas,
          'Recaudado': grupo.montoRecibido,
          'Costo Total': grupo.costoTotal,
          'Utilidad': grupo.utilidad,
          'Margen %': grupo.margen.toFixed(2)
        }));
      }

      // Agregar fila de totales
      if (agrupacion === 'ninguna') {
        dataParaExcel.push({
          'Fecha': '',
          'Fuente': '',
          'No. Documento': '',
          'Cliente': '',
          'Producto': '',
          'Referencia': 'TOTALES',
          'Talla': '',
          'Cantidad': reportData.totales.cantidadTotal,
          'Precio Unit.': '',
          'Subtotal': reportData.totales.ventasTotal,
          'Recaudado': reportData.totales.montoRecibidoTotal,
          'Costo Unit.': '',
          'Costo Total': reportData.totales.costoTotal,
          'Utilidad': reportData.totales.utilidadTotal,
          'Margen %': reportData.totales.margenPromedio.toFixed(2),
          'Método Pago': '',
          'Colegio': ''
        });
      } else {
        dataParaExcel.push({
          'Grupo': 'TOTALES',
          'Cantidad Total': reportData.totales.cantidadTotal,
          'Total Ventas': reportData.totales.ventasTotal,
          'Recaudado': reportData.totales.montoRecibidoTotal,
          'Costo Total': reportData.totales.costoTotal,
          'Utilidad': reportData.totales.utilidadTotal,
          'Margen %': reportData.totales.margenPromedio.toFixed(2)
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Ventas');

      const fileName = `Reporte_Ventas_${formatDateForInput(startDate)}_${formatDateForInput(endDate)}.xlsx`;
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
          <TrendingUp size={28} style={{ color: '#D50565' }} />
          Reporte de Ventas
        </h1>
        <p className="text-gray-600 mt-1">Analiza las ventas por múltiples criterios</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Filter size={20} style={{ color: '#D50565' }} />
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
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

          {/* Fuente de venta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuente de Venta
            </label>
            <select
              value={fuenteVenta}
              onChange={(e) => setFuenteVenta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="todas">Todas</option>
              <option value="pos">POS (Ventas Directas)</option>
              <option value="pedidos">Pedidos (Tienda)</option>
              <option value="pedidosB2B">Pedidos B2B</option>
              <option value="apartados">Apartados</option>
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente (Opcional)
            </label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Todos los clientes</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia Producto (Opcional)
            </label>
            <input
              type="text"
              value={productoRef}
              onChange={(e) => setProductoRef(e.target.value)}
              placeholder="Ej: CH-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de Pago
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="todos">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Nequi">Nequi</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>

          {/* Colegio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colegio (Opcional)
            </label>
            <select
              value={colegioId}
              onChange={(e) => setColegioId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Todos los colegios</option>
              {colegios.map(colegio => (
                <option key={colegio.id} value={colegio.id}>
                  {colegio.nombre}
                </option>
              ))}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="ninguna">Sin agrupar (Detalle)</option>
              <option value="producto">Por Producto</option>
              <option value="cliente">Por Cliente</option>
              <option value="fecha">Por Fecha</option>
              <option value="metodoPago">Por Método de Pago</option>
            </select>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={generarReporte}
            disabled={loading}
            className="flex-1 px-6 py-3 text-white rounded-lg font-medium shadow-md transition-all disabled:opacity-50"
            style={{ backgroundColor: '#D50565' }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cantidad Total</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {reportData.totales.cantidadTotal.toLocaleString()}
                  </p>
                </div>
                <Package size={32} className="text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Ventas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(reportData.totales.ventasTotal)}
                  </p>
                </div>
                <DollarSign size={32} className="text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Recaudado</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(reportData.totales.montoRecibidoTotal)}
                  </p>
                </div>
                <DollarSign size={32} className="text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Utilidad</p>
                  <p className="text-2xl font-bold" style={{ color: '#D50565' }}>
                    {formatCurrency(reportData.totales.utilidadTotal)}
                  </p>
                </div>
                <TrendingUp size={32} style={{ color: '#D50565' }} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Margen Promedio</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {reportData.totales.margenPromedio.toFixed(2)}%
                  </p>
                </div>
                <Calendar size={32} className="text-purple-500" />
              </div>
            </div>
          </div>

          {/* Tabla de Resultados */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {agrupacion === 'ninguna' ? (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Doc</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Talla</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cant</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P. Unit</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recaudado</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Colegio</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {agrupacion === 'producto' ? 'Producto' :
                           agrupacion === 'cliente' ? 'Cliente' :
                           agrupacion === 'fecha' ? 'Fecha' :
                           agrupacion === 'metodoPago' ? 'Método Pago' : 'Grupo'}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Ventas</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recaudado</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Total</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen %</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {agrupacion === 'ninguna' ? (
                    reportData.datos.map((venta, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{venta.fecha.toLocaleDateString('es-CO')}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{venta.fuente}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{venta.numeroDocumento}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{venta.clienteNombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{venta.productoNombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{venta.referencia}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{venta.talla}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{venta.cantidad}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(venta.precioUnitario)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(venta.subtotal)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-orange-600 text-right">{formatCurrency(venta.montoRecibido)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">{formatCurrency(venta.utilidad)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{venta.margen.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{venta.colegioNombre || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    reportData.datos.map((grupo, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{grupo.nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{grupo.cantidad.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(grupo.totalVentas)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-orange-600 text-right">{formatCurrency(grupo.montoRecibido)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(grupo.costoTotal)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">{formatCurrency(grupo.utilidad)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{grupo.margen.toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReporteVentas;
