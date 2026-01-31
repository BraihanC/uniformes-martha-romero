import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { TrendingUp, Package, DollarSign, Percent } from 'lucide-react';

const ReporteUtilidad = () => {
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [utilidadPorProducto, setUtilidadPorProducto] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (productos.length > 0 && ventas.length > 0) {
      calcularUtilidades();
    }
  }, [productos, ventas, filtroFechaInicio, filtroFechaFin]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Cargar todos los productos
      const productosSnapshot = await getDocs(collection(db, 'products'));
      const productosData = productosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProductos(productosData);

      // 2. Cargar todas las ventas
      const ventasSnapshot = await getDocs(
        query(collection(db, 'sales'), orderBy('createdAt', 'desc'))
      );
      const ventasData = ventasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVentas(ventasData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      alert('Error al cargar los datos del reporte.');
    } finally {
      setLoading(false);
    }
  };

  const calcularUtilidades = () => {
    // Crear un mapa de productos por ID para acceso rápido
    const productosMap = new Map(productos.map(p => [p.id, p]));

    // Filtrar ventas por fecha si hay filtros activos
    let ventasFiltradas = ventas;
    if (filtroFechaInicio || filtroFechaFin) {
      ventasFiltradas = ventas.filter(venta => {
        if (!venta.createdAt) return false;
        const fechaVenta = venta.createdAt.toDate ? venta.createdAt.toDate() : new Date(venta.createdAt);

        if (filtroFechaInicio) {
          const fechaInicio = new Date(filtroFechaInicio);
          if (fechaVenta < fechaInicio) return false;
        }

        if (filtroFechaFin) {
          const fechaFin = new Date(filtroFechaFin);
          fechaFin.setHours(23, 59, 59, 999); // Incluir todo el día
          if (fechaVenta > fechaFin) return false;
        }

        return true;
      });
    }

    // Agrupar ventas por producto
    const utilidadMap = new Map();

    ventasFiltradas.forEach(venta => {
      if (!venta.items) return;

      // ✅ Excluir facturas de tipo 'pedido' - estas son documentos de referencia
      // Las ventas de pedidos ya se cuentan por separado
      if (venta.tipo === 'pedido') return;

      venta.items.forEach(item => {
        const producto = productosMap.get(item.productoId);

        // Solo procesar productos comprados a proveedores (costoCompra > 0)
        if (!producto || !producto.costoCompra || producto.costoCompra <= 0) {
          return;
        }

        const cantidad = item.cantidad || 0;
        const precioVenta = item.precioUnitario || 0;
        const costoCompra = producto.costoCompra || 0;
        const utilidadUnitaria = precioVenta - costoCompra;
        const utilidadTotal = utilidadUnitaria * cantidad;
        const ingresoTotal = precioVenta * cantidad;
        const costoTotal = costoCompra * cantidad;

        if (!utilidadMap.has(item.productoId)) {
          utilidadMap.set(item.productoId, {
            productoId: item.productoId,
            nombre: item.nombre,
            referencia: item.referencia,
            talla: item.talla || 'Única',
            cantidadVendida: 0,
            ingresoTotal: 0,
            costoTotal: 0,
            utilidadTotal: 0,
            precioVentaPromedio: 0,
            costoCompra: costoCompra
          });
        }

        const registro = utilidadMap.get(item.productoId);
        registro.cantidadVendida += cantidad;
        registro.ingresoTotal += ingresoTotal;
        registro.costoTotal += costoTotal;
        registro.utilidadTotal += utilidadTotal;
      });
    });

    // Convertir a array y calcular métricas finales
    const utilidadArray = Array.from(utilidadMap.values()).map(item => {
      const margenPorcentaje = item.costoTotal > 0
        ? ((item.utilidadTotal / item.costoTotal) * 100)
        : 0;

      return {
        ...item,
        margenPorcentaje: margenPorcentaje
      };
    });

    // Ordenar por utilidad total (mayor a menor)
    utilidadArray.sort((a, b) => b.utilidadTotal - a.utilidadTotal);

    setUtilidadPorProducto(utilidadArray);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    return value.toFixed(1) + '%';
  };

  // Calcular totales generales
  const totalIngresos = utilidadPorProducto.reduce((sum, item) => sum + item.ingresoTotal, 0);
  const totalCostos = utilidadPorProducto.reduce((sum, item) => sum + item.costoTotal, 0);
  const totalUtilidad = utilidadPorProducto.reduce((sum, item) => sum + item.utilidadTotal, 0);
  const margenGeneral = totalCostos > 0 ? ((totalUtilidad / totalCostos) * 100) : 0;
  const totalUnidadesVendidas = utilidadPorProducto.reduce((sum, item) => sum + item.cantidadVendida, 0);

  const limpiarFiltros = () => {
    setFiltroFechaInicio('');
    setFiltroFechaFin('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">Cargando reporte de utilidad...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Reporte de Utilidad - Productos Comprados</h2>
        <p className="text-gray-600 mt-1">
          Análisis de rentabilidad de productos comprados a proveedores
        </p>
      </div>

      {/* Filtros de Fecha */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={limpiarFiltros}
              className="w-full px-4 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Utilidad Total</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalUtilidad)}</p>
            </div>
            <TrendingUp size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Ingresos Totales</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalIngresos)}</p>
            </div>
            <DollarSign size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Margen Promedio</p>
              <p className="text-2xl font-bold mt-1">{formatPercent(margenGeneral)}</p>
            </div>
            <Percent size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Unidades Vendidas</p>
              <p className="text-2xl font-bold mt-1">{totalUnidadesVendidas}</p>
            </div>
            <Package size={40} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Tabla de Productos */}
      {utilidadPorProducto.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            No hay datos para mostrar
          </h3>
          <p className="text-gray-600">
            {filtroFechaInicio || filtroFechaFin
              ? 'No se encontraron ventas de productos comprados en el rango de fechas seleccionado.'
              : 'No hay ventas registradas de productos comprados a proveedores.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidades Vendidas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Costo Compra
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Costo Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ingresos Totales
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilidad Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margen %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {utilidadPorProducto.map((item, index) => (
                  <tr key={item.productoId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.nombre}</p>
                        <p className="text-sm text-gray-500">
                          Ref: {item.referencia} {item.talla !== 'Única' && `| Talla: ${item.talla}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">
                        {item.cantidadVendida}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">
                      {formatCurrency(item.costoCompra)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-red-600">
                      {formatCurrency(item.costoTotal)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-blue-600">
                      {formatCurrency(item.ingresoTotal)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                      {formatCurrency(item.utilidadTotal)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        item.margenPorcentaje >= 50 ? 'bg-green-100 text-green-800' :
                        item.margenPorcentaje >= 30 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {formatPercent(item.margenPorcentaje)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr className="font-bold">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    TOTALES
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    {totalUnidadesVendidas}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">
                    -
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-red-600">
                    {formatCurrency(totalCostos)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-blue-600">
                    {formatCurrency(totalIngresos)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600">
                    {formatCurrency(totalUtilidad)}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-900">
                    {formatPercent(margenGeneral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Leyenda de Márgenes */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Interpretación de Márgenes:</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-800 font-semibold rounded-full">≥ 50%</span>
            <span className="text-gray-600">Excelente margen</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 font-semibold rounded-full">30-49%</span>
            <span className="text-gray-600">Buen margen</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-red-100 text-red-800 font-semibold rounded-full">{'<'} 30%</span>
            <span className="text-gray-600">Margen bajo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReporteUtilidad;
