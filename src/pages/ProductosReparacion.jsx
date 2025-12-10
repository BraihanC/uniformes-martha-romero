import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
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
  User,
  Factory,
  Users,
  Building
} from 'lucide-react';

const ProductosReparacion = () => {
  const { currentUser } = useAuth();
  const [productosReparacion, setProductosReparacion] = useState([]);
  const [reportesB2B, setReportesB2B] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [accion, setAccion] = useState(null); // 'reparar' o 'baja'
  const [observaciones, setObservaciones] = useState('');
  const [activeTab, setActiveTab] = useState('clientes'); // 'clientes', 'satelites' o 'b2b'

  // Cargar productos en reparación y reportes B2B
  useEffect(() => {
    fetchProductosReparacion();
    fetchReportesB2B();
  }, []);

  const fetchProductosReparacion = async () => {
    setLoading(true);
    try {
      const reparacionSnapshot = await getDocs(collection(db, 'productosReparacion'));
      const productos = reparacionSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(p => p.estado === 'Pendiente'); // Solo pendientes

      setProductosReparacion(productos);
    } catch (error) {
      console.error('Error al cargar productos en reparación:', error);
      alert('Error al cargar productos en reparación');
    } finally {
      setLoading(false);
    }
  };

  const fetchReportesB2B = async () => {
    try {
      const reportesRef = collection(db, 'reportes_imperfectos');
      const q = query(
        reportesRef,
        where('resuelto', '==', false)
      );
      const querySnapshot = await getDocs(q);

      const reportes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setReportesB2B(reportes);
    } catch (error) {
      console.error('Error al cargar reportes B2B:', error);
    }
  };

  // Filtrar por origen
  const productosClientes = productosReparacion.filter(p => p.origen !== 'satelite');
  const productosSatelites = productosReparacion.filter(p => p.origen === 'satelite');

  const handleOpenModal = (producto, tipoAccion) => {
    setSelectedProducto(producto);
    setAccion(tipoAccion);
    setObservaciones('');
    setShowModal(true);
  };

  const handleMarcarReparado = async () => {
    if (!selectedProducto) return;

    try {
      // 1. Actualizar estado del documento en productosReparacion
      const reparacionRef = doc(db, 'productosReparacion', selectedProducto.id);
      await updateDoc(reparacionRef, {
        estado: 'Reparado',
        fechaReparacion: serverTimestamp(),
        observacionesReparacion: observaciones,
        reparadoPor: currentUser.uid
      });

      // 2. Devolver las unidades al stock total del producto
      const productoRef = doc(db, 'products', selectedProducto.productId);
      await updateDoc(productoRef, {
        stockTotal: increment(selectedProducto.cantidad),
        updatedAt: serverTimestamp()
      });

      alert(`✅ ${selectedProducto.cantidad} unidades de "${selectedProducto.nombre}" fueron marcadas como reparadas y devueltas al inventario`);
      setShowModal(false);
      fetchProductosReparacion();
    } catch (error) {
      console.error('Error al marcar como reparado:', error);
      alert('Error al marcar como reparado: ' + error.message);
    }
  };

  const handleDarDeBaja = async () => {
    if (!selectedProducto) return;

    if (!observaciones.trim()) {
      alert('Por favor, ingresa las observaciones sobre el motivo de la baja.');
      return;
    }

    const confirmar = window.confirm(
      `¿Estás seguro de dar de baja ${selectedProducto.cantidad} unidades de "${selectedProducto.nombre}"?\n\nEsta acción eliminará estas unidades del inventario permanentemente.`
    );

    if (!confirmar) return;

    try {
      // 1. Actualizar estado del documento en productosReparacion
      const reparacionRef = doc(db, 'productosReparacion', selectedProducto.id);
      await updateDoc(reparacionRef, {
        estado: 'Baja',
        fechaBaja: serverTimestamp(),
        observacionesBaja: observaciones,
        bajaPor: currentUser.uid
      });

      alert(`❌ ${selectedProducto.cantidad} unidades de "${selectedProducto.nombre}" fueron dadas de baja del inventario`);
      setShowModal(false);
      fetchProductosReparacion();
    } catch (error) {
      console.error('Error al dar de baja:', error);
      alert('Error al dar de baja: ' + error.message);
    }
  };

  const calcularEstadisticas = (productos) => {
    const totalUnidades = productos.reduce((sum, p) => sum + (p.cantidad || 0), 0);
    const totalProductos = productos.length;

    return { totalUnidades, totalProductos };
  };

  const calcularEstadisticasB2B = (reportes) => {
    const totalUnidades = reportes.reduce((sum, r) => sum + (r.producto?.cantidadDefectuosa || 0), 0);
    const totalProductos = reportes.length;

    return { totalUnidades, totalProductos };
  };

  const statsClientes = calcularEstadisticas(productosClientes);
  const statsSatelites = calcularEstadisticas(productosSatelites);
  const statsB2B = calcularEstadisticasB2B(reportesB2B);
  const statsTotal = {
    totalUnidades: statsClientes.totalUnidades + statsSatelites.totalUnidades + statsB2B.totalUnidades,
    totalProductos: statsClientes.totalProductos + statsSatelites.totalProductos + statsB2B.totalProductos
  };

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

  const ProductoCard = ({ producto }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-gray-800">{producto.nombre}</p>
          <p className="text-xs text-gray-500">Ref: {producto.referencia}</p>
          {producto.talla && <p className="text-xs text-gray-500">Talla: {producto.talla}</p>}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          {producto.cantidad || 0}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-gray-600">
          {producto.origen === 'satelite' ? (
            <>
              <p className="font-medium text-orange-600">Satélite: {producto.sateliteNombre}</p>
              <p className="text-xs">Defectos de fábrica</p>
            </>
          ) : (
            <>
              {producto.facturaId && <p>Factura: #{producto.numeroFactura}</p>}
              {producto.cliente && <p>Cliente: {producto.cliente}</p>}
              {producto.razon && <p className="text-xs">Razón: {producto.razon}</p>}
            </>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <p className="text-xs text-gray-500">
          {producto.fechaIngreso && new Date(producto.fechaIngreso.toDate()).toLocaleDateString('es-CO')}
        </p>
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
  );

  const ProductoCardMobile = ({ producto }) => (
    <div className="p-4 border-b border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <p className="font-medium text-gray-800">{producto.nombre}</p>
          <p className="text-xs text-gray-500">Ref: {producto.referencia}</p>
          {producto.talla && <p className="text-xs text-gray-500">Talla: {producto.talla}</p>}
        </div>
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {producto.cantidad}
        </span>
      </div>
      <div className="text-xs text-gray-600 mb-3">
        {producto.origen === 'satelite' ? (
          <>
            <p className="font-medium text-orange-600">Satélite: {producto.sateliteNombre}</p>
            <p>Defectos de fábrica</p>
          </>
        ) : (
          <>
            {producto.facturaId && <p>Factura: #{producto.numeroFactura}</p>}
            {producto.cliente && <p>Cliente: {producto.cliente}</p>}
            {producto.razon && <p>Razón: {producto.razon}</p>}
          </>
        )}
        <p className="mt-1">
          Ingreso: {producto.fechaIngreso && new Date(producto.fechaIngreso.toDate()).toLocaleDateString('es-CO')}
        </p>
      </div>
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
  );

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

      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Unidades en Reparación</p>
              <p className="text-3xl font-bold mt-1">{statsTotal.totalUnidades}</p>
            </div>
            <Package size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Casos Pendientes</p>
              <p className="text-3xl font-bold mt-1">{statsTotal.totalProductos}</p>
            </div>
            <AlertTriangle size={40} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="grid grid-cols-3 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('clientes')}
            className={`px-4 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'clientes'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users size={20} />
            <span className="hidden sm:inline">Devoluciones de Clientes</span>
            <span className="sm:hidden">Clientes</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
              activeTab === 'clientes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {statsClientes.totalUnidades}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('satelites')}
            className={`px-4 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'satelites'
                ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Factory size={20} />
            <span className="hidden sm:inline">Defectos de Satélites</span>
            <span className="sm:hidden">Satélites</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
              activeTab === 'satelites' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {statsSatelites.totalUnidades}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('b2b')}
            className={`px-4 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'b2b'
                ? 'bg-pink-50 text-pink-600 border-b-2 border-pink-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Building size={20} />
            <span className="hidden sm:inline">Reparación B2B</span>
            <span className="sm:hidden">B2B</span>
            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
              activeTab === 'b2b' ? 'bg-pink-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {statsB2B.totalUnidades}
            </span>
          </button>
        </div>

        {/* Contenido de las tabs */}
        <div className="p-6">
          {activeTab === 'clientes' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Productos Devueltos por Clientes</h3>
              {productosClientes.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                  <p className="text-gray-600">No hay devoluciones de clientes pendientes</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalles</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fecha Ingreso</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {productosClientes.map(producto => (
                          <ProductoCard key={producto.id} producto={producto} />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden">
                    {productosClientes.map(producto => (
                      <ProductoCardMobile key={producto.id} producto={producto} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'satelites' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Productos con Defectos de Fábrica</h3>
              {productosSatelites.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                  <p className="text-gray-600">No hay productos con defectos de satélites pendientes</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalles</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fecha Ingreso</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {productosSatelites.map(producto => (
                          <ProductoCard key={producto.id} producto={producto} />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden">
                    {productosSatelites.map(producto => (
                      <ProductoCardMobile key={producto.id} producto={producto} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'b2b' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Reportes de Imperfectos B2B</h3>
              {reportesB2B.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                  <p className="text-gray-600">No hay reportes de imperfectos B2B pendientes</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad Defectuosa</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalles</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fecha Reporte</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reportesB2B.map(reporte => (
                          <tr key={reporte.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-800">{reporte.producto?.descripcion}</p>
                                <p className="text-xs text-gray-500">Talla: {reporte.producto?.talla}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                {reporte.producto?.cantidadDefectuosa || 0}
                              </span>
                              <p className="text-xs text-gray-500 mt-1">
                                de {reporte.producto?.cantidadTotal}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-600">
                                <p className="font-medium" style={{ color: '#D50565' }}>
                                  {reporte.clienteNombre}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Pedido: #{reporte.pedidoNumero}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {reporte.descripcionProblema?.substring(0, 50)}...
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <p className="text-xs text-gray-500">
                                {reporte.createdAt && new Date(reporte.createdAt.toDate()).toLocaleDateString('es-CO')}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                reporte.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                                reporte.estado === 'En Revisión' ? 'bg-blue-100 text-blue-800' :
                                reporte.estado === 'Aprobado' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {reporte.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden">
                    {reportesB2B.map(reporte => (
                      <div key={reporte.id} className="p-4 border-b border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{reporte.producto?.descripcion}</p>
                            <p className="text-xs text-gray-500">Talla: {reporte.producto?.talla}</p>
                          </div>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {reporte.producto?.cantidadDefectuosa}/{reporte.producto?.cantidadTotal}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mb-3">
                          <p className="font-medium" style={{ color: '#D50565' }}>
                            {reporte.clienteNombre}
                          </p>
                          <p className="text-gray-500">Pedido: #{reporte.pedidoNumero}</p>
                          <p className="mt-1">{reporte.descripcionProblema?.substring(0, 60)}...</p>
                          <p className="mt-1">
                            Reportado: {reporte.createdAt && new Date(reporte.createdAt.toDate()).toLocaleDateString('es-CO')}
                          </p>
                        </div>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                          reporte.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          reporte.estado === 'En Revisión' ? 'bg-blue-100 text-blue-800' :
                          reporte.estado === 'Aprobado' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {reporte.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Nota:</strong> Para gestionar estos reportes (aprobar, rechazar, agregar resolución), ve a la sección <strong>"Reportes Imperfectos"</strong> en el menú lateral.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedProducto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {accion === 'reparar' ? 'Marcar como Reparado' : 'Dar de Baja'}
                  </h2>
                  <p className="text-gray-600 mt-1">{selectedProducto.nombre}</p>
                  <p className="text-sm text-gray-500">Ref: {selectedProducto.referencia} • Talla: {selectedProducto.talla}</p>
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
              {/* Información del producto */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Cantidad:</p>
                    <p className="font-semibold text-red-600">{selectedProducto.cantidad} unidades</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Origen:</p>
                    <p className="font-semibold">
                      {selectedProducto.origen === 'satelite'
                        ? `Satélite: ${selectedProducto.sateliteNombre}`
                        : 'Devolución de cliente'}
                    </p>
                  </div>
                  {selectedProducto.facturaId && (
                    <div>
                      <p className="text-gray-600">Factura:</p>
                      <p className="font-semibold">#{selectedProducto.numeroFactura}</p>
                    </div>
                  )}
                  {selectedProducto.cliente && (
                    <div>
                      <p className="text-gray-600">Cliente:</p>
                      <p className="font-semibold">{selectedProducto.cliente}</p>
                    </div>
                  )}
                  {selectedProducto.razon && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Razón del defecto:</p>
                      <p className="font-semibold">{selectedProducto.razon}</p>
                    </div>
                  )}
                  {selectedProducto.notas && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Notas:</p>
                      <p className="text-sm">{selectedProducto.notas}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario de acción */}
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  {accion === 'reparar'
                    ? `Vas a marcar ${selectedProducto.cantidad} unidades como reparadas. Estas unidades volverán al stock disponible para venta.`
                    : `Vas a dar de baja ${selectedProducto.cantidad} unidades. Estas unidades serán eliminadas permanentemente del inventario.`
                  }
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones {accion === 'baja' ? <span className="text-red-500">*</span> : '(opcional)'}
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    rows="3"
                    placeholder={accion === 'reparar'
                      ? 'Agrega observaciones sobre la reparación...'
                      : 'Agrega el motivo de la baja... (requerido)'}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={accion === 'reparar' ? handleMarcarReparado : handleDarDeBaja}
                className={`flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 ${
                  accion === 'reparar' ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                {accion === 'reparar' ? 'Confirmar Reparación' : 'Confirmar Baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductosReparacion;
