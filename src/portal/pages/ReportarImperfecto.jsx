import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, addDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { usePortalAuth } from '../context/PortalAuthContext';
import { AlertCircle, Package, CheckCircle, Download, FileText, Clock, CheckCircle2, XCircle } from 'lucide-react';

const ReportarImperfecto = () => {
  const { user, clienteCorporativo } = usePortalAuth();
  const [pedidos, setPedidos] = useState([]);
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [cantidadDefectuosa, setCantidadDefectuosa] = useState(1);
  const [descripcionProblema, setDescripcionProblema] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [vistaActual, setVistaActual] = useState('crear'); // 'crear' o 'historial'

  useEffect(() => {
    if (clienteCorporativo?.id) {
      fetchPedidosEntregados();
      fetchReportes();
    }
  }, [clienteCorporativo]);

  const fetchPedidosEntregados = async () => {
    try {
      setLoading(true);
      const pedidosRef = collection(db, 'pedidos_b2b');
      const q = query(
        pedidosRef,
        where('clienteId', '==', clienteCorporativo.id),
        where('estado', '==', 'Entregado'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const pedidosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPedidos(pedidosData);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      alert('Error al cargar pedidos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportes = async () => {
    try {
      const reportesRef = collection(db, 'reportes_imperfectos');
      const q = query(
        reportesRef,
        where('clienteId', '==', clienteCorporativo.id),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const reportesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setReportes(reportesData);
    } catch (error) {
      console.error('Error al cargar reportes:', error);
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

  const formatDateShort = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const getEstadoColor = (estado) => {
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

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return <Clock size={16} />;
      case 'En Revisión':
        return <AlertCircle size={16} />;
      case 'Aprobado':
        return <CheckCircle2 size={16} />;
      case 'Rechazado':
        return <XCircle size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const exportarReportes = () => {
    if (reportes.length === 0) {
      alert('No hay reportes para exportar');
      return;
    }

    let contenido = `HISTORIAL DE REPORTES DE IMPERFECTOS\n`;
    contenido += `${clienteCorporativo.nombre}\n`;
    contenido += `Fecha de Exportación: ${new Date().toLocaleDateString('es-CO')}\n`;
    contenido += `\n`;
    contenido += `${'='.repeat(80)}\n`;

    reportes.forEach((reporte, index) => {
      contenido += `\nREPORTE #${index + 1}\n`;
      contenido += `${'-'.repeat(80)}\n`;
      contenido += `Fecha: ${formatDate(reporte.createdAt)}\n`;
      contenido += `Pedido: #${reporte.pedidoNumero}\n`;
      contenido += `Estado: ${reporte.estado}\n`;
      contenido += `\n`;
      contenido += `PRODUCTO:\n`;
      contenido += `  - Descripción: ${reporte.producto.descripcion}\n`;
      contenido += `  - Talla: ${reporte.producto.talla}\n`;
      contenido += `  - Cantidad Total: ${reporte.producto.cantidadTotal}\n`;
      contenido += `  - Cantidad Defectuosa: ${reporte.producto.cantidadDefectuosa}\n`;
      contenido += `  - Precio Unitario: ${formatCurrency(reporte.producto.precioUnitario)}\n`;
      contenido += `\n`;
      contenido += `PROBLEMA REPORTADO:\n`;
      contenido += `${reporte.descripcionProblema}\n`;

      if (reporte.resolucion) {
        contenido += `\n`;
        contenido += `RESOLUCIÓN:\n`;
        contenido += `${reporte.resolucion}\n`;
        if (reporte.fechaResolucion) {
          contenido += `Fecha de Resolución: ${formatDate(reporte.fechaResolucion)}\n`;
        }
        if (reporte.resueltoPor) {
          contenido += `Resuelto Por: ${reporte.resueltoPor}\n`;
        }
      }

      contenido += `\n${'='.repeat(80)}\n`;
    });

    // Descargar
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reportes_imperfectos_${clienteCorporativo.nombre}_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitReporte = async (e) => {
    e.preventDefault();

    if (!selectedPedido || !selectedProducto) {
      alert('Selecciona un pedido y un producto');
      return;
    }

    if (cantidadDefectuosa < 1 || cantidadDefectuosa > selectedProducto.cantidad) {
      alert('La cantidad defectuosa debe ser entre 1 y ' + selectedProducto.cantidad);
      return;
    }

    if (!descripcionProblema.trim()) {
      alert('Describe el problema encontrado');
      return;
    }

    try {
      setSubmitting(true);

      const reporte = {
        pedidoId: selectedPedido.id,
        pedidoNumero: selectedPedido.id.slice(-6).toUpperCase(),
        clienteId: clienteCorporativo.id,
        clienteNombre: clienteCorporativo.nombre,
        codigoColegio: clienteCorporativo.codigoColegio,
        producto: {
          productoId: selectedProducto.productoId,
          codigo: selectedProducto.codigo,
          descripcion: selectedProducto.descripcion,
          talla: selectedProducto.talla,
          cantidadTotal: selectedProducto.cantidad,
          cantidadDefectuosa: cantidadDefectuosa,
          precioUnitario: selectedProducto.precioUnitario
        },
        descripcionProblema: descripcionProblema.trim(),
        estado: 'Pendiente', // Pendiente, En Revisión, Aprobado, Rechazado
        createdAt: serverTimestamp(),
        reportadoPor: user.email,
        resuelto: false
      };

      await addDoc(collection(db, 'reportes_imperfectos'), reporte);

      setSuccessMessage('Reporte enviado exitosamente. Nos pondremos en contacto contigo pronto.');

      // Limpiar formulario
      setSelectedPedido(null);
      setSelectedProducto(null);
      setCantidadDefectuosa(1);
      setDescripcionProblema('');

      // Recargar reportes
      fetchReportes();

      // Ocultar mensaje después de 5 segundos
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error al enviar reporte:', error);
      alert('Error al enviar reporte: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-0">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <AlertCircle size={24} className="md:w-7 md:h-7" style={{ color: '#D50565' }} />
              <span className="text-base md:text-2xl">Reportar Producto Imperfecto</span>
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Si recibiste productos con imperfecciones o defectos, repórtalos aquí.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setVistaActual('crear')}
              className={`flex-1 sm:flex-none px-3 md:px-4 py-2 text-sm md:text-base rounded-lg font-medium transition-colors ${
                vistaActual === 'crear'
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={vistaActual === 'crear' ? { backgroundColor: '#D50565' } : {}}
            >
              Crear Reporte
            </button>
            <button
              onClick={() => setVistaActual('historial')}
              className={`flex-1 sm:flex-none px-3 md:px-4 py-2 text-sm md:text-base rounded-lg font-medium transition-colors ${
                vistaActual === 'historial'
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={vistaActual === 'historial' ? { backgroundColor: '#D50565' } : {}}
            >
              Mis Reportes ({reportes.length})
            </button>
          </div>
        </div>
      </div>

      {/* Vista Crear Reporte */}
      {vistaActual === 'crear' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Mensaje de Éxito */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-800 font-medium">¡Reporte enviado!</p>
                <p className="text-green-700 text-sm mt-1">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmitReporte} className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* Seleccionar Pedido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona el Pedido *
              </label>
              {pedidos.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <Package size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600">No tienes pedidos entregados</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Solo puedes reportar imperfecciones en pedidos que ya fueron entregados
                  </p>
                </div>
              ) : (
                <select
                  value={selectedPedido?.id || ''}
                  onChange={(e) => {
                    const pedido = pedidos.find(p => p.id === e.target.value);
                    setSelectedPedido(pedido);
                    setSelectedProducto(null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                >
                  <option value="">-- Selecciona un pedido --</option>
                  {pedidos.map(pedido => (
                    <option key={pedido.id} value={pedido.id}>
                      Pedido #{pedido.id.slice(-6).toUpperCase()} - {formatDate(pedido.createdAt)} - {formatCurrency(pedido.total)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Seleccionar Producto */}
            {selectedPedido && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecciona el Producto con Imperfección *
                </label>
                <select
                  value={selectedProducto ? JSON.stringify(selectedProducto) : ''}
                  onChange={(e) => {
                    const producto = JSON.parse(e.target.value);
                    setSelectedProducto(producto);
                    setCantidadDefectuosa(1);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                >
                  <option value="">-- Selecciona un producto --</option>
                  {selectedPedido.productos?.map((producto, index) => (
                    <option key={index} value={JSON.stringify(producto)}>
                      {producto.descripcion} - Talla {producto.talla} (Cantidad: {producto.cantidad})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cantidad Defectuosa */}
            {selectedProducto && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿Cuántas piezas tienen imperfecciones? *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedProducto.cantidad}
                  value={cantidadDefectuosa}
                  onChange={(e) => setCantidadDefectuosa(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Máximo: {selectedProducto.cantidad} piezas
                </p>
              </div>
            )}

            {/* Descripción del Problema */}
            {selectedProducto && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Describe el Problema *
                </label>
                <textarea
                  value={descripcionProblema}
                  onChange={(e) => setDescripcionProblema(e.target.value)}
                  placeholder="Describe detalladamente el defecto o imperfección encontrada (ej: costura descosida, mancha, talla incorrecta, etc.)"
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Sé lo más específico posible para que podamos resolver el problema rápidamente
                </p>
              </div>
            )}

            {/* Botones */}
            {selectedProducto && (
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPedido(null);
                    setSelectedProducto(null);
                    setCantidadDefectuosa(1);
                    setDescripcionProblema('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#D50565' }}
                  disabled={submitting}
                >
                  {submitting ? 'Enviando...' : 'Enviar Reporte'}
                </button>
              </div>
            )}
          </form>

          {/* Información Adicional */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">
              Información Importante
            </h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Solo puedes reportar imperfecciones en pedidos ya entregados</li>
              <li>• Revisaremos tu reporte y nos comunicaremos contigo lo antes posible</li>
              <li>• Guarda los productos con imperfecciones hasta que resolvamos el caso</li>
              <li>• Si es posible, toma fotos de las imperfecciones para futura referencia</li>
            </ul>
          </div>
        </div>
      )}

      {/* Vista Historial de Reportes */}
      {vistaActual === 'historial' && (
        <div className="space-y-6">
          {/* Botón de Exportar */}
          {reportes.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={exportarReportes}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Download size={18} />
                Exportar Reportes
              </button>
            </div>
          )}

          {/* Lista de Reportes */}
          {reportes.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <FileText size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No has realizado reportes
              </h3>
              <p className="text-gray-500">
                Tus reportes de productos imperfectos aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportes.map((reporte) => (
                <div
                  key={reporte.id}
                  className="bg-white rounded-lg shadow-md p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-800">
                          Pedido #{reporte.pedidoNumero}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getEstadoColor(
                            reporte.estado
                          )}`}
                        >
                          {getEstadoIcon(reporte.estado)}
                          {reporte.estado}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Reportado el {formatDate(reporte.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Información del Producto */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Producto Reportado</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Descripción:</span>
                        <p className="font-medium text-gray-800">{reporte.producto.descripcion}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Talla:</span>
                        <p className="font-medium text-gray-800">{reporte.producto.talla}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Cantidad Defectuosa:</span>
                        <p className="font-medium text-red-600">
                          {reporte.producto.cantidadDefectuosa} de {reporte.producto.cantidadTotal}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Descripción del Problema */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Problema Reportado</h4>
                    <p className="text-gray-700 whitespace-pre-wrap bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      {reporte.descripcionProblema}
                    </p>
                  </div>

                  {/* Resolución */}
                  {reporte.resolucion && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                        <CheckCircle size={18} />
                        Resolución
                      </h4>
                      <p className="text-green-700 whitespace-pre-wrap mb-2">
                        {reporte.resolucion}
                      </p>
                      {reporte.fechaResolucion && (
                        <p className="text-xs text-green-600">
                          Resuelto el {formatDate(reporte.fechaResolucion)}
                          {reporte.resueltoPor && ` por ${reporte.resueltoPor}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportarImperfecto;
