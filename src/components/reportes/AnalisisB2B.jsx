import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, TrendingUp, Package, User, Calendar, CreditCard, Plus, Eye, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const AnalisisB2B = () => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [montoAbono, setMontoAbono] = useState('');
  const [notasAbono, setNotasAbono] = useState('');
  const [registrandoAbono, setRegistrandoAbono] = useState(false);

  // Filtros
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const pedidosRef = collection(db, 'pedidos_b2b');
      const q = query(pedidosRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const pedidosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPedidos(pedidosData);
    } catch (error) {
      console.error('Error al cargar pedidos B2B:', error);
      alert('Error al cargar pedidos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const calcularTotalAbonado = (abonos) => {
    if (!abonos || abonos.length === 0) return 0;
    return abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0);
  };

  const calcularSaldoPendiente = (total, abonos) => {
    return (total || 0) - calcularTotalAbonado(abonos);
  };

  const calcularEstadoPago = (total, abonos) => {
    const totalAbonado = calcularTotalAbonado(abonos);
    if (totalAbonado === 0) return 'Sin pagar';
    if (totalAbonado >= total) return 'Pagado';
    return 'Abonado';
  };

  // Calcular totales y costos del pedido
  const calcularFinanzasPedido = (pedido) => {
    let totalVenta = 0;
    let totalCosto = 0;

    (pedido.productos || []).forEach(producto => {
      const cantidad = producto.cantidad || 0;
      const precioVenta = producto.precioVenta || 0;
      const costoUnitario = producto.costoUnitario || 0;

      totalVenta += cantidad * precioVenta;
      totalCosto += cantidad * costoUnitario;
    });

    const utilidadBruta = totalVenta - totalCosto;
    const margenPorcentaje = totalVenta > 0 ? ((utilidadBruta / totalVenta) * 100) : 0;

    return {
      totalVenta,
      totalCosto,
      utilidadBruta,
      margenPorcentaje
    };
  };

  // Registrar abono
  const handleRegistrarAbono = async () => {
    if (!montoAbono || isNaN(montoAbono) || parseFloat(montoAbono) <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    const monto = parseFloat(montoAbono);
    const saldoActual = calcularSaldoPendiente(selectedPedido.total, selectedPedido.abonos);

    if (monto > saldoActual) {
      alert(`El monto del abono no puede ser mayor al saldo pendiente (${formatCurrency(saldoActual)})`);
      return;
    }

    setRegistrandoAbono(true);

    try {
      const pedidoRef = doc(db, 'pedidos_b2b', selectedPedido.id);

      const nuevoAbono = {
        monto: monto,
        fecha: serverTimestamp(),
        registradoPor: user?.displayName || user?.email || 'Administrador',
        notas: notasAbono.trim()
      };

      await updateDoc(pedidoRef, {
        abonos: arrayUnion(nuevoAbono),
        updatedAt: serverTimestamp()
      });

      // Registrar en transacciones
      const nuevoSaldo = saldoActual - monto;
      await addDoc(collection(db, 'transactions'), {
        tipo: 'abono_pedido_b2b',
        monto: monto,
        fecha: serverTimestamp(),
        pedidoB2BId: selectedPedido.id,
        numeroPedido: selectedPedido.numeroPedido || 0,
        clienteNombre: selectedPedido.clienteNombre || '',
        codigoColegio: selectedPedido.codigoColegio || '',
        metodoPago: 'No especificado',
        referencia: '',
        notas: notasAbono.trim(),
        totalPedido: selectedPedido.total || 0,
        saldoPendiente: nuevoSaldo,
        createdAt: serverTimestamp(),
        createdBy: user?.displayName || user?.email || 'Administrador'
      });

      alert('Abono registrado exitosamente');
      setShowAbonoModal(false);
      setMontoAbono('');
      setNotasAbono('');
      fetchPedidos();
    } catch (error) {
      console.error('Error al registrar abono:', error);
      alert('Error al registrar abono: ' + error.message);
    } finally {
      setRegistrandoAbono(false);
    }
  };

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter(pedido => {
    // Filtro por cliente
    if (filtroCliente !== 'todos' && pedido.clienteId !== filtroCliente) {
      return false;
    }

    // Filtro por estado
    if (filtroEstado !== 'todos' && pedido.estado !== filtroEstado) {
      return false;
    }

    // Filtro por fechas
    if (filtroFechaInicio || filtroFechaFin) {
      const fechaPedido = pedido.createdAt?.toDate?.();
      if (fechaPedido) {
        if (filtroFechaInicio) {
          const fechaInicio = new Date(filtroFechaInicio);
          fechaInicio.setHours(0, 0, 0, 0);
          if (fechaPedido < fechaInicio) {
            return false;
          }
        }
        if (filtroFechaFin) {
          const fechaFin = new Date(filtroFechaFin);
          fechaFin.setHours(23, 59, 59, 999); // Incluir todo el día
          if (fechaPedido > fechaFin) {
            return false;
          }
        }
      }
    }

    return true;
  });

  // Calcular resumen general
  const calcularResumenGeneral = () => {
    let totalVentas = 0;
    let totalCostos = 0;
    let totalAbonado = 0;
    let totalPendiente = 0;

    pedidosFiltrados.forEach(pedido => {
      const finanzas = calcularFinanzasPedido(pedido);
      totalVentas += finanzas.totalVenta;
      totalCostos += finanzas.totalCosto;
      totalAbonado += calcularTotalAbonado(pedido.abonos);
      totalPendiente += calcularSaldoPendiente(pedido.total, pedido.abonos);
    });

    const utilidadBruta = totalVentas - totalCostos;
    const margenPromedio = totalVentas > 0 ? ((utilidadBruta / totalVentas) * 100) : 0;

    return {
      totalPedidos: pedidosFiltrados.length,
      totalVentas,
      totalCostos,
      utilidadBruta,
      margenPromedio,
      totalAbonado,
      totalPendiente
    };
  };

  // Exportar a Excel
  const exportarExcel = () => {
    const datos = pedidosFiltrados.map(pedido => {
      const finanzas = calcularFinanzasPedido(pedido);
      const totalAbonado = calcularTotalAbonado(pedido.abonos);
      const saldoPendiente = calcularSaldoPendiente(pedido.total, pedido.abonos);

      return {
        'Pedido #': String(pedido.numeroPedido || 0).padStart(4, '0'),
        'Fecha': formatDate(pedido.createdAt),
        'Cliente': pedido.clienteNombre || '',
        'Colegio': pedido.nombreColegio || '',
        'Estado': pedido.estado || '',
        'Total Venta': finanzas.totalVenta,
        'Total Costo': finanzas.totalCosto,
        'Utilidad Bruta': finanzas.utilidadBruta,
        'Margen %': finanzas.margenPorcentaje.toFixed(2),
        'Total Abonado': totalAbonado,
        'Saldo Pendiente': saldoPendiente,
        'Estado Pago': calcularEstadoPago(pedido.total, pedido.abonos)
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Análisis B2B');

    // Ajustar ancho de columnas
    const wscols = [
      { wch: 12 }, // Pedido #
      { wch: 15 }, // Fecha
      { wch: 25 }, // Cliente
      { wch: 25 }, // Colegio
      { wch: 15 }, // Estado
      { wch: 15 }, // Total Venta
      { wch: 15 }, // Total Costo
      { wch: 15 }, // Utilidad Bruta
      { wch: 10 }, // Margen %
      { wch: 15 }, // Total Abonado
      { wch: 15 }, // Saldo Pendiente
      { wch: 15 }  // Estado Pago
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Analisis_B2B_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const resumen = calcularResumenGeneral();

  // Obtener lista de clientes únicos para el filtro
  const clientesUnicos = [...new Map(pedidos.map(p => [p.clienteId, { id: p.clienteId, nombre: p.clienteNombre }])).values()];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#D50565' }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen General */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4" style={{ borderLeftColor: '#D50565' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pedidos</p>
              <p className="text-2xl font-bold text-gray-800">{resumen.totalPedidos}</p>
            </div>
            <Package className="text-pink-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Ventas</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(resumen.totalVentas)}</p>
            </div>
            <DollarSign className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Utilidad Bruta</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(resumen.utilidadBruta)}</p>
              <p className="text-xs text-gray-500">Margen: {resumen.margenPromedio.toFixed(1)}%</p>
            </div>
            <TrendingUp className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Saldo Pendiente</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(resumen.totalPendiente)}</p>
              <p className="text-xs text-gray-500">Abonado: {formatCurrency(resumen.totalAbonado)}</p>
            </div>
            <CreditCard className="text-orange-600" size={32} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="todos">Todos los clientes</option>
              {clientesUnicos.map(cliente => (
                <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Producción">En Producción</option>
              <option value="Listo">Listo</option>
              <option value="Entregado">Entregado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setFiltroCliente('todos');
              setFiltroEstado('todos');
              setFiltroFechaInicio('');
              setFiltroFechaFin('');
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Limpiar Filtros
          </button>
          <button
            onClick={exportarExcel}
            className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#D50565' }}
          >
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Venta</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margen %</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Abonado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pedidosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-12 text-center text-gray-500">
                    No hay pedidos B2B para mostrar
                  </td>
                </tr>
              ) : (
                pedidosFiltrados.map(pedido => {
                  const finanzas = calcularFinanzasPedido(pedido);
                  const totalAbonado = calcularTotalAbonado(pedido.abonos);
                  const saldoPendiente = calcularSaldoPendiente(pedido.total, pedido.abonos);

                  return (
                    <tr key={pedido.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          #{String(pedido.numeroPedido || 0).padStart(4, '0')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(pedido.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{pedido.clienteNombre}</div>
                        <div className="text-xs text-gray-500">{pedido.nombreColegio}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          pedido.estado === 'Entregado' ? 'bg-green-100 text-green-800' :
                          pedido.estado === 'Listo' ? 'bg-blue-100 text-blue-800' :
                          pedido.estado === 'En Producción' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {pedido.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-green-600">
                        {formatCurrency(finanzas.totalVenta)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                        {formatCurrency(finanzas.totalCosto)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-blue-600">
                        {formatCurrency(finanzas.utilidadBruta)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <span className={finanzas.margenPorcentaje >= 30 ? 'text-green-600' : finanzas.margenPorcentaje >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                          {finanzas.margenPorcentaje.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-green-600">
                        {formatCurrency(totalAbonado)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-orange-600">
                        {formatCurrency(saldoPendiente)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setShowDetalleModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalle"
                          >
                            <Eye size={18} />
                          </button>
                          {saldoPendiente > 0 && (
                            <button
                              onClick={() => {
                                setSelectedPedido(pedido);
                                setShowAbonoModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Registrar abono"
                            >
                              <Plus size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle */}
      {showDetalleModal && selectedPedido && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                Detalle Financiero - Pedido #{String(selectedPedido.numeroPedido || 0).padStart(4, '0')}
              </h2>
              <button
                onClick={() => setShowDetalleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Información del Cliente */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <User size={18} />
                  Información del Cliente
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <p className="font-medium">{selectedPedido.clienteNombre}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Colegio:</span>
                    <p className="font-medium">{selectedPedido.nombreColegio}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Fecha:</span>
                    <p className="font-medium">{formatDate(selectedPedido.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Estado:</span>
                    <p className="font-medium">{selectedPedido.estado}</p>
                  </div>
                </div>
              </div>

              {/* Productos con Costos */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Package size={18} />
                  Productos y Costos
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Producto</th>
                        <th className="px-3 py-2 text-center">Cant.</th>
                        <th className="px-3 py-2 text-right">Costo Unit.</th>
                        <th className="px-3 py-2 text-right">Precio Venta</th>
                        <th className="px-3 py-2 text-right">Costo Total</th>
                        <th className="px-3 py-2 text-right">Venta Total</th>
                        <th className="px-3 py-2 text-right">Utilidad</th>
                        <th className="px-3 py-2 text-right">Margen %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(selectedPedido.productos || []).map((prod, idx) => {
                        const cantidad = prod.cantidad || 0;
                        const precioVenta = prod.precioVenta || 0;
                        const costoUnitario = prod.costoUnitario || 0;
                        const costoTotal = cantidad * costoUnitario;
                        const ventaTotal = cantidad * precioVenta;
                        const utilidad = ventaTotal - costoTotal;
                        const margen = ventaTotal > 0 ? ((utilidad / ventaTotal) * 100) : 0;

                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <div className="font-medium">{prod.nombre}</div>
                              <div className="text-xs text-gray-500">
                                Talla: {prod.talla} | Ref: {prod.referencia}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">{cantidad}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(costoUnitario)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(precioVenta)}</td>
                            <td className="px-3 py-2 text-right text-red-600">{formatCurrency(costoTotal)}</td>
                            <td className="px-3 py-2 text-right text-green-600">{formatCurrency(ventaTotal)}</td>
                            <td className="px-3 py-2 text-right font-medium text-blue-600">{formatCurrency(utilidad)}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                                {margen.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen Financiero */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <DollarSign size={18} />
                  Resumen Financiero
                </h3>
                {(() => {
                  const finanzas = calcularFinanzasPedido(selectedPedido);
                  const totalAbonado = calcularTotalAbonado(selectedPedido.abonos);
                  const saldoPendiente = calcularSaldoPendiente(selectedPedido.total, selectedPedido.abonos);

                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Total Costo:</span>
                        <span className="font-semibold text-red-600">{formatCurrency(finanzas.totalCosto)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Total Venta:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(finanzas.totalVenta)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold text-gray-800">Utilidad Bruta:</span>
                        <span className="font-bold text-blue-600">{formatCurrency(finanzas.utilidadBruta)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-800">Margen:</span>
                        <span className={`font-bold ${finanzas.margenPorcentaje >= 30 ? 'text-green-600' : finanzas.margenPorcentaje >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {finanzas.margenPorcentaje.toFixed(2)}%
                        </span>
                      </div>
                      <div className="border-t pt-2 mt-4">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Total Abonado:</span>
                          <span className="font-semibold text-green-600">{formatCurrency(totalAbonado)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-gray-800">Saldo Pendiente:</span>
                          <span className="font-bold text-orange-600">{formatCurrency(saldoPendiente)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Historial de Abonos */}
              {selectedPedido.abonos && selectedPedido.abonos.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CreditCard size={18} />
                    Historial de Abonos
                  </h3>
                  <div className="space-y-2">
                    {selectedPedido.abonos.map((abono, idx) => (
                      <div key={idx} className="bg-gray-50 rounded p-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{formatCurrency(abono.monto)}</p>
                          <p className="text-xs text-gray-600">
                            {formatDate(abono.fecha)} - {abono.registradoPor}
                          </p>
                          {abono.notas && <p className="text-xs text-gray-500 mt-1">{abono.notas}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Abono */}
      {showAbonoModal && selectedPedido && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-800">Registrar Abono</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded p-3 text-sm">
                <p className="text-gray-600">Cliente: <span className="font-semibold">{selectedPedido.clienteNombre}</span></p>
                <p className="text-gray-600">Pedido: <span className="font-semibold">#{String(selectedPedido.numeroPedido || 0).padStart(4, '0')}</span></p>
                <p className="text-gray-600">Saldo Pendiente: <span className="font-semibold text-orange-600">
                  {formatCurrency(calcularSaldoPendiente(selectedPedido.total, selectedPedido.abonos))}
                </span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto del Abono *</label>
                <input
                  type="number"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="0"
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={notasAbono}
                  onChange={(e) => setNotasAbono(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  rows="3"
                  placeholder="Información adicional sobre el abono..."
                />
              </div>
            </div>
            <div className="border-t px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowAbonoModal(false);
                  setMontoAbono('');
                  setNotasAbono('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarAbono}
                disabled={registrandoAbono}
                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#D50565' }}
              >
                {registrandoAbono ? 'Registrando...' : 'Registrar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisB2B;
