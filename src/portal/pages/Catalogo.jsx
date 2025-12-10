import { useState, useEffect } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { useCart } from '../context/CartContext';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Search, ShoppingCart, Package } from 'lucide-react';

const Catalogo = () => {
  const { clienteCorporativo } = usePortalAuth();
  const { addToCart } = useCart();
  const [productos, setProductos] = useState([]);
  const [productosFiltrados, setProductosFiltrados] = useState([]);
  const [preciosCorporativos, setPreciosCorporativos] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [cantidades, setCantidades] = useState({}); // {productoId: cantidad}

  useEffect(() => {
    if (clienteCorporativo) {
      fetchCatalogo();
    }
  }, [clienteCorporativo]);

  useEffect(() => {
    filtrarProductos();
  }, [searchTerm, tipoFilter, productos]);

  const fetchCatalogo = async () => {
    try {
      setLoading(true);

      // 1. Obtener el código del colegio (directamente del cliente o buscando el documento)
      let colegioCode;

      if (clienteCorporativo.codigoColegio) {
        // Si el cliente tiene el código directamente, usarlo
        colegioCode = clienteCorporativo.codigoColegio;
      } else if (clienteCorporativo.colegioId) {
        // Si tiene colegioId, buscar el documento
        const colegioDoc = await getDoc(doc(db, 'colegios', clienteCorporativo.colegioId));
        if (!colegioDoc.exists()) {
          throw new Error('Colegio no encontrado. Por favor contacta al administrador.');
        }
        colegioCode = colegioDoc.data().codigo;
      } else {
        throw new Error('El cliente no tiene un colegio asignado');
      }

      // 2. Obtener precios corporativos para este cliente
      const preciosRef = collection(db, 'precios_corporativos');
      const preciosQuery = query(
        preciosRef,
        where('clienteId', '==', clienteCorporativo.id)
      );
      const preciosSnapshot = await getDocs(preciosQuery);

      const preciosMap = {};
      preciosSnapshot.forEach(doc => {
        const data = doc.data();
        preciosMap[data.productoId] = data.precioEspecial;
      });

      setPreciosCorporativos(preciosMap);

      // 3. Obtener productos B2B del colegio
      const productosRef = collection(db, 'products');
      const productosQuery = query(
        productosRef,
        where('colegio', '==', colegioCode),
        where('esB2B', '==', true)
      );
      const productosSnapshot = await getDocs(productosQuery);

      const productosData = productosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por categoría y nombre
      productosData.sort((a, b) => {
        if (a.categoria !== b.categoria) {
          return a.categoria.localeCompare(b.categoria);
        }
        return a.nombre.localeCompare(b.nombre);
      });

      setProductos(productosData);
      setProductosFiltrados(productosData);
    } catch (error) {
      console.error('Error al cargar catálogo:', error);
      alert('Error al cargar el catálogo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filtrarProductos = () => {
    let filtered = [...productos];

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.nombre.toLowerCase().includes(term) ||
        p.categoria?.toLowerCase().includes(term) ||
        p.talla?.toLowerCase().includes(term) ||
        p.tipo?.toLowerCase().includes(term)
      );
    }

    // Filtrar por tipo (diario/deportivo)
    if (tipoFilter !== 'todos') {
      filtered = filtered.filter(p => {
        const tipo = (p.tipo || '').toLowerCase();
        if (tipoFilter === 'diario') {
          return tipo === 'diario' || tipo === 'dia';
        } else if (tipoFilter === 'deportivo') {
          return tipo === 'deportivo' || tipo === 'dep';
        }
        return true;
      });
    }

    setProductosFiltrados(filtered);
  };

  const getPrecio = (producto) => {
    // Si hay precio corporativo, usar ese; si no, usar precio regular
    return preciosCorporativos[producto.id] || producto.precio || 0;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getCantidad = (productoId) => {
    return cantidades[productoId] || 1;
  };

  const updateCantidad = (productoId, cantidad) => {
    const cantidadNum = parseInt(cantidad) || 1;
    setCantidades(prev => ({
      ...prev,
      [productoId]: Math.max(1, cantidadNum)
    }));
  };

  const handleAgregarAlCarrito = (producto) => {
    const cantidad = getCantidad(producto.id);
    const precio = getPrecio(producto);

    addToCart({
      id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.nombre,
      talla: producto.talla,
      precio: precio,
      tipo: producto.tipo,
      categoria: producto.categoria
    }, cantidad);

    // Mostrar notificación
    alert(`${cantidad} x ${producto.nombre} agregado al carrito`);

    // Resetear cantidad
    setCantidades(prev => ({
      ...prev,
      [producto.id]: 1
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Catálogo de Uniformes
        </h1>
        <p className="text-gray-600">
          {clienteCorporativo?.nombre}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {productosFiltrados.length} {productosFiltrados.length === 1 ? 'producto disponible' : 'productos disponibles'}
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Búsqueda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, categoría o talla..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="todos">Todos los tipos</option>
              <option value="diario">Diario</option>
              <option value="deportivo">Deportivo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Productos */}
      {productosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No se encontraron productos
          </h3>
          <p className="text-gray-500">
            Intenta ajustar los filtros de búsqueda
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {productosFiltrados.map(producto => {
            const precio = getPrecio(producto);
            const tienePrecioEspecial = preciosCorporativos[producto.id] !== undefined;
            const stockDisponible = producto.stockDisponible || 0;

            return (
              <div
                key={producto.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {/* Placeholder del Producto (sin imagen por el momento) */}
                <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
                  <Package size={64} className="text-gray-300" />

                  {/* Badge de Precio Especial */}
                  {tienePrecioEspecial && (
                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-semibold text-white rounded" style={{ backgroundColor: '#D50565' }}>
                      Precio Especial
                    </div>
                  )}

                  {/* Badge de Stock */}
                  {stockDisponible <= 0 && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded">
                      Sobre Pedido
                    </div>
                  )}
                </div>

                {/* Información del Producto */}
                <div className="p-4">
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {producto.categoria}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {producto.nombre}
                  </h3>

                  {producto.talla && (
                    <p className="text-sm text-gray-600 mb-2">
                      Talla: <span className="font-medium">{producto.talla}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-2xl font-bold" style={{ color: '#D50565' }}>
                        {formatCurrency(precio)}
                      </p>
                      {producto.precio && tienePrecioEspecial && producto.precio !== precio && (
                        <p className="text-sm text-gray-400 line-through">
                          {formatCurrency(producto.precio)}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-500">Stock</p>
                      <p className={`text-sm font-semibold ${stockDisponible > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stockDisponible}
                      </p>
                    </div>
                  </div>

                  {/* Selector de Cantidad y Botón */}
                  <div className="space-y-2">
                    {/* Selector de Cantidad */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">
                        Cantidad:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={getCantidad(producto.id)}
                        onChange={(e) => updateCantidad(producto.id, e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-pink-500"
                      />
                    </div>

                    {/* Botón Agregar al Carrito */}
                    <button
                      onClick={() => handleAgregarAlCarrito(producto)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-white hover:opacity-90"
                      style={{ backgroundColor: '#D50565' }}
                    >
                      <ShoppingCart size={18} />
                      <span>Agregar al Carrito</span>
                    </button>

                    {/* Indicador de Stock (Informativo) */}
                    {stockDisponible === 0 && (
                      <p className="text-xs text-orange-600 text-center">
                        Se producirá sobre pedido
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Catalogo;
