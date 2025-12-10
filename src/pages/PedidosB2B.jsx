import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion, serverTimestamp, query, orderBy, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Package, DollarSign, CheckCircle, Clock, Eye, Plus, Calendar, CreditCard } from 'lucide-react';

const PedidosB2B = () => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [montoAbono, setMontoAbono] = useState('');
  const [notasAbono, setNotasAbono] = useState('');

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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const calcularTotalAbonado = (abonos) => {
    if (!abonos || abonos.length === 0) return 0;
    return abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0);
  };

  const calcularSaldoPendiente = (total, abonos) => {
    return total - calcularTotalAbonado(abonos);
  };

  const calcularEstadoPago = (total, abonos) => {
    const totalAbonado = calcularTotalAbonado(abonos);
    if (totalAbonado === 0) return 'Sin Pagar';
    if (totalAbonado >= total) return 'Pagado';
    return 'Pago Parcial';
  };

  const getEstadoPagoBadgeColor = (estadoPago) => {
    switch (estadoPago) {
      case 'Pagado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Pago Parcial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Sin Pagar':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const crearNotificacion = async (pedido, tipo, titulo, mensaje) => {
    try {
      await addDoc(collection(db, 'notificaciones_portal'), {
        clienteId: pedido.clienteId,
        tipo: tipo,
        titulo: titulo,
        mensaje: mensaje,
        leida: false,
        pedidoId: pedido.id,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error al crear notificación:', error);
    }
  };

  const handleAprobarPedido = async (pedido) => {
    if (!window.confirm('¿Aprobar este pedido?')) return;

    try {
      const pedidoRef = doc(db, 'pedidos_b2b', pedido.id);
      await updateDoc(pedidoRef, {
        estado: 'En Preparación',
        aprobado: true,
        aprobadoPor: user.displayName || user.email,
        fechaAprobacion: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Crear notificación para el cliente
      await crearNotificacion(
        pedido,
        'pedido_estado',
        'Pedido Aprobado',
        `Tu pedido #${pedido.id.slice(-6).toUpperCase()} ha sido aprobado y está en preparación.`
      );

      alert('Pedido aprobado exitosamente');
      fetchPedidos();
    } catch (error) {
      console.error('Error al aprobar pedido:', error);
      alert('Error al aprobar pedido: ' + error.message);
    }
  };

  const handleRegistrarAbono = async () => {
    const monto = parseFloat(montoAbono);
    if (!monto || monto <= 0) {
      alert('Ingresa un monto válido');
      return;
    }

    if (!notasAbono.trim()) {
      alert('Ingresa notas del abono');
      return;
    }

    try {
      const pedidoRef = doc(db, 'pedidos_b2b', selectedPedido.id);
      const nuevoAbono = {
        monto: monto,
        fecha: serverTimestamp(),
        registradoPor: user.displayName || user.email,
        notas: notasAbono.trim()
      };

      await updateDoc(pedidoRef, {
        abonos: arrayUnion(nuevoAbono),
        updatedAt: serverTimestamp()
      });

      // Calcular nuevo saldo
      const nuevoSaldo = calcularSaldoPendiente(selectedPedido.total, [...(selectedPedido.abonos || []), nuevoAbono]);

      // Crear notificación para el cliente
      await crearNotificacion(
        selectedPedido,
        'abono_registrado',
        'Pago Registrado',
        `Se ha registrado un pago de ${formatCurrency(monto)} en tu pedido #${selectedPedido.id.slice(-6).toUpperCase()}. Saldo pendiente: ${formatCurrency(nuevoSaldo)}`
      );

      alert('Abono registrado exitosamente');
      setShowAbonoModal(false);
      setMontoAbono('');
      setNotasAbono('');
      fetchPedidos();
    } catch (error) {
      console.error('Error al registrar abono:', error);
      alert('Error al registrar abono: ' + error.message);
    }
  };

  const getEstadoBadgeColor = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'En Preparación':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Despachado':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Entregado':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Cargando pedidos B2B...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Package size={28} style={{ color: '#D50565' }} />
          Pedidos B2B (Portal Corporativo)
        </h1>
        <p className="text-gray-600">
          {pedidos.length} {pedidos.length === 1 ? 'pedido registrado' : 'pedidos registrados'}
        </p>
      </div>

      {/* Tabla de Pedidos */}
      {pedidos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No hay pedidos B2B registrados
          </h3>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abonado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado Pago
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pedidos.map((pedido) => {
                  const totalAbonado = calcularTotalAbonado(pedido.abonos);
                  const saldoPendiente = calcularSaldoPendiente(pedido.total, pedido.abonos);
                  const estadoPago = calcularEstadoPago(pedido.total, pedido.abonos);

                  return (
                    <tr key={pedido.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          #{pedido.id.slice(-6).toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{pedido.clienteNombre}</div>
                        <div className="text-xs text-gray-500">{pedido.codigoColegio}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(pedido.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(pedido.total)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(totalAbonado)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${saldoPendiente > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {formatCurrency(saldoPendiente)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getEstadoBadgeColor(pedido.estado)}`}>
                          {pedido.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getEstadoPagoBadgeColor(estadoPago)}`}>
                          <CreditCard size={12} className="mr-1" />
                          {estadoPago}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setShowDetalleModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalles"
                          >
                            <Eye size={18} />
                          </button>
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
                          {pedido.estado === 'Pendiente' && !pedido.aprobado && (
                            <button
                              onClick={() => handleAprobarPedido(pedido)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Aprobar pedido"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detalle Pedido */}
      {showDetalleModal && selectedPedido && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                Detalle Pedido #{selectedPedido.id.slice(-6).toUpperCase()}
              </h2>
              <button
                onClick={() => setShowDetalleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Cliente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Información del Cliente</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <span className="ml-2 font-medium">{selectedPedido.clienteNombre}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Colegio:</span>
                    <span className="ml-2 font-medium">{selectedPedido.codigoColegio}</span>
                  </div>
                </div>
              </div>

              {/* Productos */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Productos</h3>
                <div className="space-y-2">
                  {selectedPedido.productos?.map((producto, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                      <div>
                        <p className="font-medium text-gray-800">{producto.descripcion}</p>
                        <p className="text-sm text-gray-500">
                          Talla: {producto.talla} • Cantidad: {producto.cantidad}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">
                          {formatCurrency(producto.subtotal)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(producto.precioUnitario)} c/u
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historial de Abonos */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Historial de Abonos</h3>
                {!selectedPedido.abonos || selectedPedido.abonos.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay abonos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {selectedPedido.abonos.map((abono, index) => (
                      <div key={index} className="bg-green-50 border border-green-200 p-3 rounded">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-green-800">
                              {formatCurrency(abono.monto)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              <Calendar size={12} className="inline mr-1" />
                              {formatDate(abono.fecha)}
                            </p>
                            <p className="text-xs text-gray-600">
                              Registrado por: {abono.registradoPor}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">{abono.notas}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen Financiero */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total del Pedido:</span>
                    <span className="font-semibold">{formatCurrency(selectedPedido.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Abonado:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(calcularTotalAbonado(selectedPedido.abonos))}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Saldo Pendiente:</span>
                    <span style={{ color: '#D50565' }}>
                      {formatCurrency(calcularSaldoPendiente(selectedPedido.total, selectedPedido.abonos))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {selectedPedido.notas && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                  <h4 className="font-semibold text-gray-800 mb-2">Notas del Pedido</h4>
                  <p className="text-sm text-gray-700">{selectedPedido.notas}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Abono */}
      {showAbonoModal && selectedPedido && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-xl font-bold text-gray-800">Registrar Abono</h2>
              <button
                onClick={() => {
                  setShowAbonoModal(false);
                  setMontoAbono('');
                  setNotasAbono('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Info del Pedido */}
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  Pedido: <span className="font-semibold">#{selectedPedido.id.slice(-6).toUpperCase()}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Cliente: <span className="font-semibold">{selectedPedido.clienteNombre}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Saldo Pendiente: <span className="font-semibold" style={{ color: '#D50565' }}>
                    {formatCurrency(calcularSaldoPendiente(selectedPedido.total, selectedPedido.abonos))}
                  </span>
                </p>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto del Abono *
                </label>
                <input
                  type="number"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas del Abono *
                </label>
                <textarea
                  value={notasAbono}
                  onChange={(e) => setNotasAbono(e.target.value)}
                  placeholder="Ej: Transferencia Bancolombia #12345, Efectivo, etc."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAbonoModal(false);
                    setMontoAbono('');
                    setNotasAbono('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegistrarAbono}
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90"
                  style={{ backgroundColor: '#D50565' }}
                >
                  Registrar Abono
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosB2B;
