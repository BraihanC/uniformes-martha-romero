import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment,
  query,
  where
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  User
} from 'lucide-react';

const ProductosReparacion = () => {
  const { currentUser } = useAuth();
  const [productosDefectuosos, setProductosDefectuosos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [accion, setAccion] = useState(null); // 'reparar' o 'baja'
  const [observaciones, setObservaciones] = useState('');

  // Cargar productos con defectos
  useEffect(() => {
    fetchProductosDefectuosos();
  }, []);

  const fetchProductosDefectuosos = async () => {
    setLoading(true);
    try {
      const productosSnapshot = await getDocs(collection(db, 'products'));
      const productos = productosSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(p => (p.stockDefectuoso || 0) > 0);

      setProductosDefectuosos(productos);
    } catch (error) {
      console.error('Error al cargar productos defectuosos:', error);
      alert('Error al cargar productos defectuosos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (producto, tipoAccion) => {
    setSelectedProducto(producto);
    setAccion(tipoAccion);
    setObservaciones('');
    setShowModal(true);
  };

  const handleMarcarReparado = async () => {
    if (!selectedProducto) return;

    try {
      const productoRef = doc(db, 'products', selectedProducto.id);

      // Actualizar historial de defectos: marcar todos como reparados
      const historialActualizado = (selectedProducto.historialDefectos || []).map(defecto => ({
        ...defecto,
        estado: 'reparado',
        fechaReparacion: new Date().toISOString(),
        observaciones: observaciones
      }));

      // Devolver el stock defectuoso al stock total
      await updateDoc(productoRef, {
        stockTotal: increment(selectedProducto.stockDefectuoso),
        stockDefectuoso: 0,
        historialDefectos: historialActualizado
      });

      alert(`✅ ${selectedProducto.stockDefectuoso} unidades de "${selectedProducto.nombre}" fueron marcadas como reparadas y devueltas al inventario`);
      setShowModal(false);
      fetchProductosDefectuosos();
    } catch (error) {
      console.error('Error al marcar como reparado:', error);
      alert('Error al marcar como reparado');
    }
  };

  const handleDarDeBaja = async () => {
    if (!selectedProducto) return;

    const confirmar = window.confirm(
      `¿Estás seguro de dar de baja ${selectedProducto.stockDefectuoso} unidades de "${selectedProducto.nombre}"?\n\nEsta acción eliminará estas unidades del inventario permanentemente.`
    );

    if (!confirmar) return;

    try {
      const productoRef = doc(db, 'products', selectedProducto.id);

      // Actualizar historial: marcar como dado de baja
      const historialActualizado = (selectedProducto.historialDefectos || []).map(defecto => ({
        ...defecto,
        estado: 'baja',
        fechaBaja: new Date().toISOString(),
        observaciones: observaciones
      }));

      // Eliminar del stock defectuoso (no lo devuelve al stock total)
      await updateDoc(productoRef, {
        stockDefectuoso: 0,
        historialDefectos: historialActualizado
      });

      alert(`❌ ${selectedProducto.stockDefectuoso} unidades de "${selectedProducto.nombre}" fueron dadas de baja del inventario`);
      setShowModal(false);
      fetchProductosDefectuosos();
    } catch (error) {
      console.error('Error al dar de baja:', error);
      alert('Error al dar de baja');
    }
  };

  const calcularEstadisticas = () => {
    const totalUnidades = productosDefectuosos.reduce((sum, p) => sum + (p.stockDefectuoso || 0), 0);
    const totalProductos = productosDefectuosos.length;
    const valorEstimado = productosDefectuosos.reduce((sum, p) =>
      sum + ((p.stockDefectuoso || 0) * (p.precioVenta || 0)), 0
    );

    return { totalUnidades, totalProductos, valorEstimado };
  };

  const stats = calcularEstadisticas();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando productos en reparación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Wrench className="text-orange-600" size={32} />
          Productos en Reparación
        </h1>
        <p className="text-gray-600 mt-1">Gestiona productos con defectos pendientes de reparación</p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Unidades</p>
              <p className="text-3xl font-bold mt-1">{stats.totalUnidades}</p>
            </div>
            <Package size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Productos Afectados</p>
              <p className="text-3xl font-bold mt-1">{stats.totalProductos}</p>
            </div>
            <AlertTriangle size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Valor Estimado</p>
              <p className="text-3xl font-bold mt-1">${stats.valorEstimado.toLocaleString('es-CO')}</p>
            </div>
            <TrendingUp size={40} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Lista de productos */}
      {productosDefectuosos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">¡No hay productos pendientes!</h3>
          <p className="text-gray-600">Todos los productos están en buen estado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unidades Defectuosas</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Disponible</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Defectos Registrados</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productosDefectuosos.map(producto => (
                  <tr key={producto.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-800">{producto.nombre}</p>
                        <p className="text-xs text-gray-500">Ref: {producto.referencia}</p>
                        <p className="text-xs text-gray-500">Precio: ${producto.precioVenta?.toLocaleString('es-CO')}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        {producto.stockDefectuoso || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-600">{producto.stockTotal || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedProducto(producto);
                          setAccion('ver');
                          setShowModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver Historial ({(producto.historialDefectos || []).filter(d => d.estado === 'pendiente').length})
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleOpenModal(producto, 'reparar')}
                          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          Reparado
                        </button>
                        <button
                          onClick={() => handleOpenModal(producto, 'baja')}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm flex items-center gap-1"
                        >
                          <XCircle size={14} />
                          Dar de Baja
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-200">
            {productosDefectuosos.map(producto => (
              <div key={producto.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{producto.nombre}</p>
                    <p className="text-xs text-gray-500">Ref: {producto.referencia}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {producto.stockDefectuoso} defectuosas
                  </span>
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  <p>Stock disponible: {producto.stockTotal || 0}</p>
                  <p>Precio: ${producto.precioVenta?.toLocaleString('es-CO')}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setSelectedProducto(producto);
                      setAccion('ver');
                      setShowModal(true);
                    }}
                    className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                  >
                    Ver Historial
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(producto, 'reparar')}
                      className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={14} />
                      Reparado
                    </button>
                    <button
                      onClick={() => handleOpenModal(producto, 'baja')}
                      className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm flex items-center justify-center gap-1"
                    >
                      <XCircle size={14} />
                      Baja
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedProducto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {accion === 'ver' ? 'Historial de Defectos' : accion === 'reparar' ? 'Marcar como Reparado' : 'Dar de Baja'}
                  </h2>
                  <p className="text-gray-600 mt-1">{selectedProducto.nombre}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6">
              {accion === 'ver' ? (
                // Mostrar historial
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Total de unidades defectuosas: <span className="font-semibold text-red-600">{selectedProducto.stockDefectuoso}</span>
                  </p>
                  <div className="space-y-3">
                    {(selectedProducto.historialDefectos || [])
                      .filter(d => d.estado === 'pendiente')
                      .map((defecto, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="text-red-500" size={20} />
                              <span className="font-medium text-gray-800">
                                {defecto.cantidad} unidad{defecto.cantidad > 1 ? 'es' : ''}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              <Calendar size={12} className="inline mr-1" />
                              {new Date(defecto.fecha).toLocaleDateString('es-CO')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>Razón:</strong> {defecto.razon}</p>
                            <p><strong>Talla:</strong> {defecto.talla}</p>
                            <p><strong>Factura:</strong> #{defecto.numeroFactura}</p>
                            <p><strong>Cliente:</strong> {defecto.cliente}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                // Formulario de acción
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    {accion === 'reparar'
                      ? `Vas a marcar ${selectedProducto.stockDefectuoso} unidades como reparadas. Estas unidades volverán al stock disponible.`
                      : `Vas a dar de baja ${selectedProducto.stockDefectuoso} unidades. Estas unidades serán eliminadas permanentemente del inventario.`
                    }
                  </p>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observaciones {accion === 'baja' ? '(requerido)' : '(opcional)'}
                    </label>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      rows="3"
                      placeholder="Agrega observaciones sobre la reparación o el motivo de la baja..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {accion === 'ver' ? 'Cerrar' : 'Cancelar'}
              </button>
              {accion !== 'ver' && (
                <button
                  onClick={accion === 'reparar' ? handleMarcarReparado : handleDarDeBaja}
                  className={`flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 ${
                    accion === 'reparar' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  {accion === 'reparar' ? 'Confirmar Reparación' : 'Confirmar Baja'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductosReparacion;
