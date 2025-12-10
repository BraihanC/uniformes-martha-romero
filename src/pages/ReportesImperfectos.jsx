import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';

const ReportesImperfectos = () => {
  const { user } = useAuth();
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReporte, setSelectedReporte] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showResolucionModal, setShowResolucionModal] = useState(false);
  const [resolucion, setResolucion] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('');

  useEffect(() => {
    fetchReportes();
  }, []);

  const fetchReportes = async () => {
    try {
      setLoading(true);
      const reportesRef = collection(db, 'reportes_imperfectos');
      const q = query(reportesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const reportesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setReportes(reportesData);
    } catch (error) {
      console.error('Error al cargar reportes:', error);
      alert('Error al cargar reportes: ' + error.message);
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

  const getEstadoBadgeColor = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'En Revisión':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Aprobado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Rechazado':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleActualizarEstado = async () => {
    if (!nuevoEstado) {
      alert('Selecciona un estado');
      return;
    }

    if (!resolucion.trim() && (nuevoEstado === 'Aprobado' || nuevoEstado === 'Rechazado')) {
      alert('Ingresa una resolución/comentario');
      return;
    }

    try {
      const reporteRef = doc(db, 'reportes_imperfectos', selectedReporte.id);

      const updateData = {
        estado: nuevoEstado,
        resuelto: nuevoEstado === 'Aprobado' || nuevoEstado === 'Rechazado',
        resolucion: resolucion.trim(),
        resueltoPor: user.displayName || user.email,
        fechaResolucion: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(reporteRef, updateData);

      // Crear notificación para el cliente
      await addDoc(collection(db, 'notificaciones_portal'), {
        clienteId: selectedReporte.clienteId,
        tipo: 'reporte_respondido',
        titulo: 'Respuesta a Reporte de Imperfecto',
        mensaje: `Tu reporte sobre "${selectedReporte.producto.descripcion}" ha sido ${nuevoEstado.toLowerCase()}. ${resolucion.trim()}`,
        leida: false,
        pedidoId: selectedReporte.pedidoId,
        createdAt: serverTimestamp()
      });

      alert('Reporte actualizado exitosamente');
      setShowResolucionModal(false);
      setResolucion('');
      setNuevoEstado('');
      fetchReportes();
    } catch (error) {
      console.error('Error al actualizar reporte:', error);
      alert('Error al actualizar reporte: ' + error.message);
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return <Clock size={18} className="text-yellow-600" />;
      case 'En Revisión':
        return <AlertCircle size={18} className="text-blue-600" />;
      case 'Aprobado':
        return <CheckCircle size={18} className="text-green-600" />;
      case 'Rechazado':
        return <XCircle size={18} className="text-red-600" />;
      default:
        return <AlertCircle size={18} className="text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <AlertCircle size={28} style={{ color: '#D50565' }} />
          Reportes de Productos Imperfectos
        </h1>
        <p className="text-gray-600">
          {reportes.length} {reportes.length === 1 ? 'reporte' : 'reportes'} registrados
        </p>
      </div>

      {/* Tabla de Reportes */}
      {reportes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <CheckCircle size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No hay reportes de imperfectos
          </h3>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad Defectuosa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportes.map((reporte) => (
                  <tr key={reporte.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(reporte.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{reporte.clienteNombre}</div>
                      <div className="text-xs text-gray-500">{reporte.codigoColegio}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      #{reporte.pedidoNumero}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{reporte.producto.descripcion}</div>
                      <div className="text-xs text-gray-500">Talla: {reporte.producto.talla}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-red-600">
                        {reporte.producto.cantidadDefectuosa} de {reporte.producto.cantidadTotal}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex items-center gap-2 text-xs leading-5 font-semibold rounded-full border ${getEstadoBadgeColor(reporte.estado)}`}>
                        {getEstadoIcon(reporte.estado)}
                        {reporte.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedReporte(reporte);
                            setShowDetalleModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver detalles"
                        >
                          <Eye size={18} />
                        </button>
                        {!reporte.resuelto && (
                          <button
                            onClick={() => {
                              setSelectedReporte(reporte);
                              setShowResolucionModal(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Actualizar estado"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detalle Reporte */}
      {showDetalleModal && selectedReporte && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                Detalle del Reporte
              </h2>
              <button
                onClick={() => setShowDetalleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Cliente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Información del Cliente</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <span className="ml-2 font-medium">{selectedReporte.clienteNombre}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Colegio:</span>
                    <span className="ml-2 font-medium">{selectedReporte.codigoColegio}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Pedido:</span>
                    <span className="ml-2 font-medium">#{selectedReporte.pedidoNumero}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Reportado por:</span>
                    <span className="ml-2 font-medium">{selectedReporte.reportadoPor}</span>
                  </div>
                </div>
              </div>

              {/* Producto */}
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <h3 className="font-semibold text-red-800 mb-2">Producto con Imperfección</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Producto:</span>
                    <span className="font-medium">{selectedReporte.producto.descripcion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Talla:</span>
                    <span className="font-medium">{selectedReporte.producto.talla}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Cantidad Total:</span>
                    <span className="font-medium">{selectedReporte.producto.cantidadTotal} piezas</span>
                  </div>
                  <div className="flex justify-between border-t border-red-300 pt-2">
                    <span className="text-red-700 font-semibold">Cantidad Defectuosa:</span>
                    <span className="font-bold text-red-700">{selectedReporte.producto.cantidadDefectuosa} piezas</span>
                  </div>
                </div>
              </div>

              {/* Descripción del Problema */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Descripción del Problema</h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedReporte.descripcionProblema}
                </p>
              </div>

              {/* Estado */}
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Estado Actual:</span>
                <span className={`px-3 py-1 inline-flex items-center gap-2 text-sm font-semibold rounded-full border ${getEstadoBadgeColor(selectedReporte.estado)}`}>
                  {getEstadoIcon(selectedReporte.estado)}
                  {selectedReporte.estado}
                </span>
              </div>

              {/* Resolución (si existe) */}
              {selectedReporte.resolucion && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Resolución</h3>
                  <p className="text-green-700 text-sm mb-2">{selectedReporte.resolucion}</p>
                  <div className="text-xs text-green-600">
                    <p>Resuelto por: {selectedReporte.resueltoPor}</p>
                    <p>Fecha: {formatDate(selectedReporte.fechaResolucion)}</p>
                  </div>
                </div>
              )}

              {/* Fecha */}
              <div className="text-sm text-gray-500 text-right">
                Reportado el: {formatDate(selectedReporte.createdAt)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resolución */}
      {showResolucionModal && selectedReporte && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-xl font-bold text-gray-800">Actualizar Reporte</h2>
              <button
                onClick={() => {
                  setShowResolucionModal(false);
                  setResolucion('');
                  setNuevoEstado('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuevo Estado *
                </label>
                <select
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">-- Selecciona un estado --</option>
                  <option value="En Revisión">En Revisión</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </div>

              {/* Resolución/Comentario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolución/Comentario *
                </label>
                <textarea
                  value={resolucion}
                  onChange={(e) => setResolucion(e.target.value)}
                  placeholder="Describe la resolución o acción tomada..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowResolucionModal(false);
                    setResolucion('');
                    setNuevoEstado('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleActualizarEstado}
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90"
                  style={{ backgroundColor: '#D50565' }}
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportesImperfectos;
