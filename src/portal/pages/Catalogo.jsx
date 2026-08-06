import { useState, useEffect, useMemo } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { useCart } from '../context/CartContext';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { CODIGO_COMPARTIDAS, construirCatalogoB2B, resolverPrecioOficialB2B } from '../../utils/pedidosB2BLogic';
import { Search, ShoppingCart, Package, SlidersHorizontal, X } from 'lucide-react';

const Catalogo = () => {
  const { clienteCorporativo } = usePortalAuth();
  const { addToCart } = useCart();
  const [productos, setProductos] = useState([]);
  const [preciosCorporativos, setPreciosCorporativos] = useState({});
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [ordenamiento, setOrdenamiento] = useState('nombre-asc');
  const [showFiltros, setShowFiltros] = useState(false);

  const [cantidades, setCantidades] = useState({}); // {productoId: cantidad}

  useEffect(() => {
    if (clienteCorporativo) {
      fetchCatalogo();
    }
  }, [clienteCorporativo]);

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

      // 3. Obtener productos B2B del colegio específico
      const productosRef = collection(db, 'products');
      const productosColegioQuery = query(
        productosRef,
        where('colegio', '==', colegioCode),
        where('esB2B', '==', true)
      );
      const productosColegioSnapshot = await getDocs(productosColegioQuery);

      // 4. Obtener prendas COMPARTIDAS (colegio 'OT'): las que se venden en tienda
      //    y también a clientes B2B de cualquier colegio (pantalón England,
      //    bicicleteros…). Cuáles ve ESTE cliente lo decide su lista blanca
      //    `productosCompartidos` — sin lista, las ve todas (comportamiento previo).
      const productosCompartidasQuery = query(
        productosRef,
        where('colegio', '==', CODIGO_COMPARTIDAS),
        where('esB2B', '==', true)
      );
      const productosCompartidasSnapshot = await getDocs(productosCompartidasQuery);

      // 5. Combinar prendas exclusivas del colegio + compartidas habilitadas
      const productosDelColegio = productosColegioSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const productosCompartidas = productosCompartidasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const productosData = construirCatalogoB2B(
        productosDelColegio,
        productosCompartidas,
        clienteCorporativo
      );

      setProductos(productosData);
    } catch (error) {
      console.error('Error al cargar catálogo:', error);
      alert('Error al cargar el catálogo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Prioridad de precios: corporativo del cliente > precio B2B de lista > precio
  // regular. Misma resolución que usa la revalidación al crear el pedido.
  const getPrecio = (producto) => resolverPrecioOficialB2B(producto, preciosCorporativos[producto.id]);

  // Función para ordenar productos por talla
  const sortByTalla = (products) => {
    // Orden de tallas personalizado
    const tallaOrder = {
      // Tallas numéricas
      '4': 1, '6': 2, '8': 3, '10': 4, '12': 5, '14': 6, '16': 7,
      // Tallas con letras
      'SX': 8, 'S': 9, 'M': 10, 'L': 11, 'XL': 12, 'XXL': 13,
      // Variaciones comunes
      'XS': 8, 'PEQUEÑA': 14, 'MEDIANA': 15, 'GRANDE': 16,
      // Rangos de medias
      '4-6': 1.5, '6-8': 2.5, '8-10': 3.5, '10-12': 4.5, '12-14': 5.5
    };

    return [...products].sort((a, b) => {
      const tallaA = (a.talla || '').toUpperCase().trim();
      const tallaB = (b.talla || '').toUpperCase().trim();

      const orderA = tallaOrder[tallaA] || 999;
      const orderB = tallaOrder[tallaB] || 999;

      // Si ambos tienen orden definido, compararlos
      if (orderA !== 999 && orderB !== 999) {
        return orderA - orderB;
      }

      // Si uno tiene orden y el otro no, el que tiene orden va primero
      if (orderA !== 999) return -1;
      if (orderB !== 999) return 1;

      // Si ninguno tiene orden, ordenar alfabéticamente
      return tallaA.localeCompare(tallaB);
    });
  };

  // Filtrar y ordenar productos usando useMemo para mejor performance
  const productosFiltrados = useMemo(() => {
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

    // Filtrar por precio mínimo
    if (precioMin) {
      const min = parseFloat(precioMin);
      filtered = filtered.filter(p => getPrecio(p) >= min);
    }

    // Filtrar por precio máximo
    if (precioMax) {
      const max = parseFloat(precioMax);
      filtered = filtered.filter(p => getPrecio(p) <= max);
    }

    // Si hay búsqueda activa, ordenar por talla automáticamente
    if (searchTerm.trim()) {
      // Primero agrupar por nombre para mantener productos similares juntos
      filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
      // Luego ordenar por talla dentro de cada grupo
      filtered = sortByTalla(filtered);
    } else {
      // Ordenar según la opción seleccionada
      filtered.sort((a, b) => {
        switch (ordenamiento) {
          case 'nombre-asc':
            return a.nombre.localeCompare(b.nombre);
          case 'nombre-desc':
            return b.nombre.localeCompare(a.nombre);
          case 'precio-asc':
            return getPrecio(a) - getPrecio(b);
          case 'precio-desc':
            return getPrecio(b) - getPrecio(a);
          case 'categoria':
            if (a.categoria !== b.categoria) {
              return a.categoria.localeCompare(b.categoria);
            }
            return a.nombre.localeCompare(b.nombre);
          case 'talla':
            // Ordenar por talla
            return 0; // Se aplicará sortByTalla después
          default:
            return 0;
        }
      });

      // Si se seleccionó ordenamiento por talla, aplicarlo
      if (ordenamiento === 'talla') {
        filtered = sortByTalla(filtered);
      }
    }

    return filtered;
  }, [productos, searchTerm, tipoFilter, precioMin, precioMax, ordenamiento, preciosCorporativos]);

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

  const limpiarFiltros = () => {
    setSearchTerm('');
    setTipoFilter('todos');
    setPrecioMin('');
    setPrecioMax('');
    setOrdenamiento('nombre-asc');
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

  const filtrosActivos = searchTerm || tipoFilter !== 'todos' || precioMin || precioMax || ordenamiento !== 'nombre-asc';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Catálogo de Uniformes
            </h1>
            <p className="text-gray-600">
              {clienteCorporativo?.nombre}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {productosFiltrados.length} de {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
            </p>
          </div>

          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              filtrosActivos
                ? 'text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            style={filtrosActivos ? { backgroundColor: '#D50565' } : {}}
          >
            <SlidersHorizontal size={18} />
            Filtros
            {filtrosActivos && <span className="bg-white text-pink-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">!</span>}
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, categoría o talla..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>

      {/* Panel de Filtros */}
      {showFiltros && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Filtros y Ordenamiento</h3>
            <button
              onClick={() => setShowFiltros(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Ordenamiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ordenar por
              </label>
              <select
                value={ordenamiento}
                onChange={(e) => setOrdenamiento(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="nombre-asc">Nombre (A-Z)</option>
                <option value="nombre-desc">Nombre (Z-A)</option>
                <option value="precio-asc">Precio (menor a mayor)</option>
                <option value="precio-desc">Precio (mayor a menor)</option>
                <option value="categoria">Categoría</option>
                <option value="talla">Talla (4, 6, 8... S, M, L...)</option>
              </select>
            </div>

            {/* Rango de Precio */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rango de Precio
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="number"
                    value={precioMin}
                    onChange={(e) => setPrecioMin(e.target.value)}
                    placeholder="Precio mínimo"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={precioMax}
                    onChange={(e) => setPrecioMax(e.target.value)}
                    placeholder="Precio máximo"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {filtrosActivos && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={limpiarFiltros}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid de Productos */}
      {productosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {productos.length === 0 ? 'No hay productos disponibles' : 'No se encontraron productos con los filtros aplicados'}
          </h3>
          <p className="text-gray-500">
            {productos.length === 0 ? 'Los productos aparecerán aquí cuando estén disponibles' : 'Intenta ajustar los filtros de búsqueda'}
          </p>
          {productos.length > 0 && (
            <button
              onClick={limpiarFiltros}
              className="mt-4 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: '#D50565' }}
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {productosFiltrados.map(producto => {
            const precio = getPrecio(producto);
            const tienePrecioEspecial = preciosCorporativos[producto.id] !== undefined;
            const stockDisponible = Math.max(0,
              (producto.stockTotal || 0) -
              (producto.stockReservadoPedidos || 0) -
              (producto.stockReservadoApartados || 0) -
              (producto.stockReservadoB2B || 0)
            );

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
