import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  where,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  ArrowLeft,
  RefreshCw,
  DollarSign,
  Package,
  CheckCircle,
  XCircle,
  Printer,
  AlertTriangle
} from 'lucide-react';

const Devoluciones = () => {
  const { currentUser } = useAuth();

  // Estados principales
  const [facturas, setFacturas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [historial, setHistorial] = useState([]);

  // Estados de búsqueda
  const [numeroFactura, setNumeroFactura] = useState('');
  const [facturaEncontrada, setFacturaEncontrada] = useState(null);
  const [buscando, setBuscando] = useState(false);

  // Estados de selección
  const [itemsSeleccionados, setItemsSeleccionados] = useState([]);
  const [razones, setRazones] = useState({});
  const [cantidadesDevueltas, setCantidadesDevueltas] = useState({});

  // Estados de modales
  const [showDevolucionModal, setShowDevolucionModal] = useState(false);
  const [showCambioModal, setShowCambioModal] = useState(false);
  const [showTirillaModal, setShowTirillaModal] = useState(false);
  const [tirillaData, setTirillaData] = useState(null);

  // Estados de devolución
  const [metodoDevolucion, setMetodoDevolucion] = useState('Efectivo');
  const [notasDevolucion, setNotasDevolucion] = useState('');

  // Estados de cambio
  const [searchProducto, setSearchProducto] = useState('');
  const [productosNuevos, setProductosNuevos] = useState([]);
  const [tallasSeleccionadas, setTallasSeleccionadas] = useState({});
  const [metodoPagoDiferencia, setMetodoPagoDiferencia] = useState('Efectivo');
  const [notasCambio, setNotasCambio] = useState('');

  // Estado para registros expandidos en historial
  const [registrosExpandidos, setRegistrosExpandidos] = useState({});

  // Estados de paginación para historial
  const [paginaActualHistorial, setPaginaActualHistorial] = useState(1);
  const registrosPorPagina = 10;

  // Función para toggle de expansión de registros
  const toggleRegistroExpandido = (id) => {
    setRegistrosExpandidos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (currentUser) {
      fetchProductos();
      fetchCompanyConfig();
      fetchHistorial();
    }
  }, [currentUser]);

  // Resetear página de historial cuando cambie el historial
  useEffect(() => {
    setPaginaActualHistorial(1);
  }, [historial.length]);

  const fetchProductos = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const productosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProductos(productosData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const fetchCompanyConfig = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'config'));
      if (!snapshot.empty) {
        setCompanyConfig(snapshot.docs[0].data());
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  const fetchHistorial = async () => {
    try {
      const q = query(
        collection(db, 'cambiosYDevoluciones'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const historialData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistorial(historialData);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  // Buscar factura
  const handleBuscarFactura = async () => {
    if (!numeroFactura.trim()) {
      alert('Ingresa un número de factura');
      return;
    }

    setBuscando(true);
    try {
      const q = query(
        collection(db, 'sales'),
        where('numeroFactura', '==', parseInt(numeroFactura))
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert('No se encontró una factura con ese número');
        setFacturaEncontrada(null);
      } else {
        const factura = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        };
        setFacturaEncontrada(factura);
        setItemsSeleccionados([]);
        setRazones({});
        setCantidadesDevueltas({});
      }
    } catch (error) {
      console.error('Error al buscar factura:', error);
      alert('Error al buscar factura');
    } finally {
      setBuscando(false);
    }
  };

  // Manejar selección de items
  const handleToggleItem = (index) => {
    const item = facturaEncontrada.items[index];

    // No permitir seleccionar items ya procesados
    if (item.estadoDevolucion) {
      return;
    }

    if (itemsSeleccionados.includes(index)) {
      setItemsSeleccionados(itemsSeleccionados.filter(i => i !== index));
      const newRazones = { ...razones };
      const newCantidades = { ...cantidadesDevueltas };
      delete newRazones[index];
      delete newCantidades[index];
      setRazones(newRazones);
      setCantidadesDevueltas(newCantidades);
    } else {
      setItemsSeleccionados([...itemsSeleccionados, index]);
      // Establecer la cantidad por defecto como la cantidad total del item
      setCantidadesDevueltas({
        ...cantidadesDevueltas,
        [index]: item.cantidad
      });
    }
  };

  const handleSetRazon = (index, razon) => {
    setRazones({ ...razones, [index]: razon });
  };

  const handleSetCantidadDevuelta = (index, cantidad) => {
    const item = facturaEncontrada.items[index];
    const cantidadNum = parseInt(cantidad) || 0;

    // Validar que no sea mayor a la cantidad original
    if (cantidadNum > item.cantidad) {
      alert(`La cantidad máxima es ${item.cantidad}`);
      return;
    }

    // Validar que sea al menos 1
    if (cantidadNum < 1) {
      alert('La cantidad mínima es 1');
      return;
    }

    setCantidadesDevueltas({
      ...cantidadesDevueltas,
      [index]: cantidadNum
    });
  };

  // Validar que todos los items seleccionados tengan razón
  const validarSeleccion = () => {
    for (const index of itemsSeleccionados) {
      if (!razones[index]) {
        alert('Todos los productos seleccionados deben tener una razón');
        return false;
      }
    }
    return true;
  };

  // DEVOLUCIÓN
  const handleAbrirDevolucionModal = () => {
    if (itemsSeleccionados.length === 0) {
      alert('Selecciona al menos un producto');
      return;
    }
    if (!validarSeleccion()) return;
    setShowDevolucionModal(true);
  };

  const calcularMontoDevolucion = () => {
    return itemsSeleccionados.reduce((total, index) => {
      const item = facturaEncontrada.items[index];
      const cantidadDevuelta = cantidadesDevueltas[index] || item.cantidad;
      return total + (cantidadDevuelta * item.precioUnitario);
    }, 0);
  };

  const handleConfirmarDevolucion = async () => {
    try {
      const batch = writeBatch(db);
      const itemsDevueltos = itemsSeleccionados.map(index => {
        const item = facturaEncontrada.items[index];
        const cantidadDevuelta = cantidadesDevueltas[index] || item.cantidad;
        return {
          ...item,
          cantidad: cantidadDevuelta, // Usar la cantidad devuelta
          cantidadOriginal: item.cantidad, // Guardar la cantidad original
          razon: razones[index]
        };
      });

      // Actualizar stock
      for (const item of itemsDevueltos) {
        const productoRef = doc(db, 'products', item.productoId || item.product?.id);

        // Si es defecto de fabricación, va a stock defectuoso
        if (item.razon === 'Defecto de fabricación') {
          batch.update(productoRef, {
            stockDefectuoso: increment(item.cantidad),
            historialDefectos: arrayUnion({
              fecha: new Date().toISOString(),
              cantidad: item.cantidad,
              razon: item.razon,
              ventaId: facturaEncontrada.id,
              numeroFactura: facturaEncontrada.numeroFactura,
              cliente: facturaEncontrada.clienteNombre,
              talla: item.talla,
              estado: 'pendiente' // pendiente, reparado, baja
            })
          });
        } else {
          // Si no es defecto, vuelve al stock normal
          batch.update(productoRef, {
            stockTotal: increment(item.cantidad)
          });
        }
      }

      // Registrar devolución
      const devolucionRef = doc(collection(db, 'cambiosYDevoluciones'));
      const devolucionData = {
        tipo: 'devolucion',
        ventaOriginalId: facturaEncontrada.id,
        numeroFacturaOriginal: facturaEncontrada.numeroFactura,
        clienteId: facturaEncontrada.clienteId,
        clienteNombre: facturaEncontrada.clienteNombre || 'Cliente',
        itemsDevueltos: itemsDevueltos,
        montoDevuelto: calcularMontoDevolucion(),
        metodoDevolucion: metodoDevolucion,
        notas: notasDevolucion,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      };
      batch.set(devolucionRef, devolucionData);

      // Marcar items como devueltos en la factura original
      const itemsActualizados = [...facturaEncontrada.items];
      itemsSeleccionados.forEach(index => {
        itemsActualizados[index] = {
          ...itemsActualizados[index],
          estadoDevolucion: 'devuelto',
          fechaDevolucion: new Date(),
          devolucionId: devolucionRef.id
        };
      });

      const facturaRef = doc(db, 'sales', facturaEncontrada.id);
      batch.update(facturaRef, {
        items: itemsActualizados
      });

      // 4. (NUEVO) Registrar Transacción de Egreso (Devolución)
      const montoDevuelto = calcularMontoDevolucion();
      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, {
        tipo: 'devolucion',
        monto: -montoDevuelto, // ¡Importante! Monto negativo
        metodoPago: metodoDevolucion,
        devolucionId: devolucionRef.id,
        ventaId: facturaEncontrada.id,
        numeroFactura: facturaEncontrada.numeroFactura,
        descripcion: `Devolución Factura #${facturaEncontrada.numeroFactura}`,
        clienteId: facturaEncontrada.clienteId,
        clienteNombre: facturaEncontrada.clienteNombre,
        itemsDevueltos: itemsDevueltos.map(item => ({
          nombre: item.nombre,
          referencia: item.referencia || item.product?.referencia,
          talla: item.talla,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.cantidad * item.precioUnitario,
          razon: item.razon
        })),
        notas: notasDevolucion,
        fecha: serverTimestamp(),
        userId: currentUser.uid
      });

      await batch.commit();

      // Actualizar estado local de la factura
      setFacturaEncontrada(prev => ({ ...prev, items: itemsActualizados }));

      // Preparar tirilla
      setTirillaData({
        tipo: 'devolucion',
        ...devolucionData,
        fecha: new Date()
      });

      alert('Devolución registrada exitosamente');
      setShowDevolucionModal(false);
      setShowTirillaModal(true);
      limpiarFormulario();

    } catch (error) {
      console.error('Error al registrar devolución:', error);
      alert('Error al registrar devolución');
    }
  };

  // CAMBIO
  const handleAbrirCambioModal = () => {
    if (itemsSeleccionados.length === 0) {
      alert('Selecciona al menos un producto');
      return;
    }
    if (!validarSeleccion()) return;
    setShowCambioModal(true);
  };

  const productosFiltrados = productos.filter(producto => {
    const stockDisponible = producto.stockTotal || 0;
    const matchSearch = producto.nombre?.toLowerCase().includes(searchProducto.toLowerCase()) ||
                       producto.referencia?.toLowerCase().includes(searchProducto.toLowerCase());
    return matchSearch && stockDisponible > 0;
  });

  const handleAgregarProductoNuevo = (producto) => {
    const tallaKey = `${producto.id}`;
    const tallaSeleccionada = tallasSeleccionadas[tallaKey] || producto.tallas?.[0] || 'Única';

    const productoExistente = productosNuevos.find(
      p => p.id === producto.id && p.tallaSeleccionada === tallaSeleccionada
    );

    if (productoExistente) {
      alert('Este producto con esta talla ya está agregado');
      return;
    }

    setProductosNuevos([...productosNuevos, {
      id: producto.id,
      nombre: producto.nombre,
      referencia: producto.referencia,
      tallaSeleccionada: tallaSeleccionada,
      cantidad: 1,
      precio: producto.precio || 0,
      stockDisponible: producto.stockTotal || 0
    }]);
  };

  const handleTallaChange = (productoId, talla) => {
    setTallasSeleccionadas(prev => ({
      ...prev,
      [productoId]: talla
    }));
  };

  const actualizarCantidadProductoNuevo = (index, nuevaCantidad) => {
    const cantidad = parseInt(nuevaCantidad) || 0;
    const producto = productosNuevos[index];

    if (cantidad > producto.stockDisponible) {
      alert(`Solo hay ${producto.stockDisponible} unidades disponibles`);
      return;
    }

    if (cantidad < 1) {
      eliminarProductoNuevo(index);
      return;
    }

    const nuevos = [...productosNuevos];
    nuevos[index].cantidad = cantidad;
    setProductosNuevos(nuevos);
  };

  const eliminarProductoNuevo = (index) => {
    setProductosNuevos(productosNuevos.filter((_, i) => i !== index));
  };

  const calcularValorDevuelto = () => {
    return itemsSeleccionados.reduce((total, index) => {
      const item = facturaEncontrada.items[index];
      const cantidadDevuelta = cantidadesDevueltas[index] || item.cantidad;
      return total + (cantidadDevuelta * item.precioUnitario);
    }, 0);
  };

  const calcularValorNuevo = () => {
    return productosNuevos.reduce((total, p) => total + (p.cantidad * p.precio), 0);
  };

  const calcularDiferencia = () => {
    return calcularValorNuevo() - calcularValorDevuelto();
  };

  const handleConfirmarCambio = async () => {
    if (productosNuevos.length === 0) {
      alert('Agrega al menos un producto nuevo');
      return;
    }

    try {
      const batch = writeBatch(db);
      const itemsDevueltos = itemsSeleccionados.map(index => {
        const item = facturaEncontrada.items[index];
        const cantidadDevuelta = cantidadesDevueltas[index] || item.cantidad;
        return {
          ...item,
          cantidad: cantidadDevuelta, // Usar la cantidad devuelta
          cantidadOriginal: item.cantidad, // Guardar la cantidad original
          razon: razones[index]
        };
      });

      // Actualizar stock devuelto (aumentar)
      for (const item of itemsDevueltos) {
        const productoRef = doc(db, 'products', item.productoId || item.product?.id);

        // Si es defecto de fabricación, va a stock defectuoso
        if (item.razon === 'Defecto de fabricación') {
          batch.update(productoRef, {
            stockDefectuoso: increment(item.cantidad),
            historialDefectos: arrayUnion({
              fecha: new Date().toISOString(),
              cantidad: item.cantidad,
              razon: item.razon,
              ventaId: facturaEncontrada.id,
              numeroFactura: facturaEncontrada.numeroFactura,
              cliente: facturaEncontrada.clienteNombre,
              talla: item.talla,
              estado: 'pendiente'
            })
          });
        } else {
          // Si no es defecto, vuelve al stock normal
          batch.update(productoRef, {
            stockTotal: increment(item.cantidad)
          });
        }
      }

      // Actualizar stock nuevo (disminuir)
      for (const item of productosNuevos) {
        const productoRef = doc(db, 'products', item.id);
        batch.update(productoRef, {
          stockTotal: increment(-item.cantidad)
        });
      }

      const diferencia = calcularDiferencia();
      const tipoDiferencia = diferencia > 0 ? 'cliente_paga' : diferencia < 0 ? 'cliente_recibe' : 'sin_diferencia';

      // Registrar cambio
      const cambioRef = doc(collection(db, 'cambiosYDevoluciones'));
      const cambioData = {
        tipo: 'cambio',
        ventaOriginalId: facturaEncontrada.id,
        numeroFacturaOriginal: facturaEncontrada.numeroFactura,
        clienteId: facturaEncontrada.clienteId,
        clienteNombre: facturaEncontrada.clienteNombre || 'Cliente',
        itemsDevueltos: itemsDevueltos,
        itemsNuevos: productosNuevos.map(p => ({
          productoId: p.id,
          nombre: p.nombre,
          referencia: p.referencia,
          talla: p.tallaSeleccionada,
          cantidad: p.cantidad,
          precio: p.precio,
          subtotal: p.cantidad * p.precio
        })),
        valorDevuelto: calcularValorDevuelto(),
        valorNuevo: calcularValorNuevo(),
        diferenciaPrecio: Math.abs(diferencia),
        tipoDiferencia: tipoDiferencia,
        metodoPagoDiferencia: diferencia > 0 ? metodoPagoDiferencia : null,
        metodoDevolucionDiferencia: diferencia < 0 ? metodoPagoDiferencia : null,
        notas: notasCambio,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      };
      batch.set(cambioRef, cambioData);

      // Marcar items como cambiados en la factura original
      const itemsActualizados = [...facturaEncontrada.items];
      itemsSeleccionados.forEach(index => {
        itemsActualizados[index] = {
          ...itemsActualizados[index],
          estadoDevolucion: 'cambiado',
          fechaCambio: new Date(),
          cambioId: cambioRef.id
        };
      });

      const facturaRef = doc(db, 'sales', facturaEncontrada.id);
      batch.update(facturaRef, {
        items: itemsActualizados
      });

      // 4. (NUEVO) Registrar Transacción si hay diferencia
      if (diferencia !== 0) {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: diferencia > 0 ? 'cambio_ingreso' : 'cambio_egreso',
          monto: diferencia, // Positivo si cliente paga, negativo si cliente recibe
          metodoPago: metodoPagoDiferencia,
          cambioId: cambioRef.id,
          ventaId: facturaEncontrada.id,
          numeroFactura: facturaEncontrada.numeroFactura,
          descripcion: diferencia > 0
            ? `Cambio - Cliente paga diferencia Factura #${facturaEncontrada.numeroFactura}`
            : `Cambio - Cliente recibe diferencia Factura #${facturaEncontrada.numeroFactura}`,
          clienteId: facturaEncontrada.clienteId,
          clienteNombre: facturaEncontrada.clienteNombre,
          itemsDevueltos: itemsDevueltos.map(item => ({
            nombre: item.nombre,
            referencia: item.referencia || item.product?.referencia,
            talla: item.talla,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.cantidad * item.precioUnitario,
            razon: item.razon
          })),
          itemsNuevos: productosNuevos.map(p => ({
            nombre: p.nombre,
            referencia: p.referencia,
            talla: p.tallaSeleccionada,
            cantidad: p.cantidad,
            precio: p.precio,
            subtotal: p.cantidad * p.precio
          })),
          valorDevuelto: calcularValorDevuelto(),
          valorNuevo: calcularValorNuevo(),
          notas: notasCambio,
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });
      }

      await batch.commit();

      // Actualizar estado local de la factura
      setFacturaEncontrada(prev => ({ ...prev, items: itemsActualizados }));

      // Preparar tirilla
      setTirillaData({
        tipo: 'cambio',
        ...cambioData,
        fecha: new Date()
      });

      alert('Cambio registrado exitosamente');
      setShowCambioModal(false);
      setShowTirillaModal(true);
      limpiarFormulario();

    } catch (error) {
      console.error('Error al registrar cambio:', error);
      alert('Error al registrar cambio');
    }
  };

  const limpiarFormulario = () => {
    setFacturaEncontrada(null);
    setNumeroFactura('');
    setItemsSeleccionados([]);
    setRazones({});
    setCantidadesDevueltas({});
    setProductosNuevos([]);
    setMetodoDevolucion('Efectivo');
    setNotasDevolucion('');
    setNotasCambio('');
    setSearchProducto('');
    fetchHistorial();
    fetchProductos();
  };

  // Imprimir tirilla
  const handlePrintTirilla = () => {
    window.print();
  };

  const razonesList = [
    'Talla incorrecta',
    'Defecto de fabricación',
    'Preferencia del cliente',
    'Color incorrecto',
    'Otro'
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Cambios y Devoluciones</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Gestiona cambios y devoluciones de productos</p>
        </div>

        {/* Buscador de Factura */}
        {!facturaEncontrada && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Buscar Factura</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="number"
                  placeholder="Número de factura..."
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleBuscarFactura()}
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <button
                onClick={handleBuscarFactura}
                disabled={buscando}
                className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: '#D50565' }}
              >
                <Search size={20} />
                {buscando ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>
        )}

        {/* Factura Encontrada */}
        {facturaEncontrada && (
          <div className="space-y-6">
            {/* Información de la Factura */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Factura #{facturaEncontrada.numeroFactura}</h2>
                  <p className="text-gray-600 mt-1 text-sm sm:text-base">
                    Cliente: {facturaEncontrada.clienteNombre || 'Sin nombre'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Fecha: {facturaEncontrada.createdAt?.toDate?.()?.toLocaleDateString('es-CO') || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={limpiarFormulario}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm sm:text-base"
                >
                  <ArrowLeft size={18} />
                  <span className="hidden sm:inline">Buscar otra factura</span>
                  <span className="sm:hidden">Otra factura</span>
                </button>
              </div>

              {/* Vista de Tarjetas - Solo Móvil */}
              <div className="md:hidden space-y-3">
                {facturaEncontrada.items?.map((item, index) => {
                  const yaProc = item.estadoDevolucion ? true : false;
                  const isSelected = itemsSeleccionados.includes(index);
                  return (
                    <div
                      key={index}
                      className={`border rounded-lg p-3 ${
                        yaProc
                          ? 'opacity-50 bg-gray-100'
                          : isSelected
                            ? 'bg-pink-50 border-pink-300'
                            : 'border-gray-300'
                      }`}
                    >
                      {/* Header con checkbox */}
                      <div className="flex items-start gap-3 mb-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleItem(index)}
                          disabled={yaProc}
                          className="mt-1 w-4 h-4 text-pink-600 rounded focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800 text-sm">{item.nombre || item.product?.nombre}</p>
                              <p className="text-xs text-gray-600">
                                Ref: {item.referencia || item.product?.referencia} | Talla: {item.talla}
                              </p>
                            </div>
                            {yaProc && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                                item.estadoDevolucion === 'devuelto'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {item.estadoDevolucion === 'devuelto' ? 'Devuelto' : 'Cambiado'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Información del producto */}
                      <div className="grid grid-cols-3 gap-2 text-sm mb-2 ml-7">
                        <div>
                          <span className="text-gray-500 text-xs">Cant:</span>
                          <p className="font-medium text-gray-900">{item.cantidad}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Precio:</span>
                          <p className="font-medium text-gray-900">${(item.precioUnitario || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Subtotal:</span>
                          <p className="font-bold text-gray-900">${(item.subtotal || (item.cantidad * (item.precioUnitario || 0))).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Select de razón y cantidad a devolver */}
                      {isSelected && !yaProc && (
                        <div className="ml-7 space-y-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Cantidad a devolver:</label>
                            <input
                              type="number"
                              min="1"
                              max={item.cantidad}
                              value={cantidadesDevueltas[index] || item.cantidad}
                              onChange={(e) => handleSetCantidadDevuelta(index, e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Máximo: {item.cantidad}</p>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Razón:</label>
                            <select
                              value={razones[index] || ''}
                              onChange={(e) => handleSetRazon(index, e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                            >
                              <option value="">Seleccionar...</option>
                              {razonesList.map(razon => (
                                <option key={razon} value={razon}>{razon}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vista de Tabla - Solo Desktop */}
              <div className="hidden md:block border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 w-12">Sel.</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Producto</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Cant. Original</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Cant. Devolver</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Precio Unit.</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Subtotal</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Razón</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {facturaEncontrada.items?.map((item, index) => {
                      const yaProc = item.estadoDevolucion ? true : false;
                      return (
                        <tr
                          key={index}
                          className={`${
                            yaProc
                              ? 'opacity-50 bg-gray-100'
                              : itemsSeleccionados.includes(index)
                                ? 'bg-pink-50'
                                : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={itemsSeleccionados.includes(index)}
                              onChange={() => handleToggleItem(index)}
                              disabled={yaProc}
                              className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium text-gray-800">{item.nombre || item.product?.nombre}</p>
                                <p className="text-sm text-gray-600">
                                  Ref: {item.referencia || item.product?.referencia} | Talla: {item.talla}
                                </p>
                              </div>
                              {yaProc && (
                                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${
                                  item.estadoDevolucion === 'devuelto'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {item.estadoDevolucion === 'devuelto' ? 'Devuelto' : 'Cambiado'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{item.cantidad}</td>
                          <td className="px-4 py-3 text-center">
                            {itemsSeleccionados.includes(index) && !yaProc ? (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max={item.cantidad}
                                  value={cantidadesDevueltas[index] || item.cantidad}
                                  onChange={(e) => handleSetCantidadDevuelta(index, e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                />
                                <span className="text-xs text-gray-500">Máx: {item.cantidad}</span>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            ${(item.precioUnitario || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            ${(item.subtotal || (item.cantidad * (item.precioUnitario || 0))).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {itemsSeleccionados.includes(index) && !yaProc && (
                              <select
                                value={razones[index] || ''}
                                onChange={(e) => handleSetRazon(index, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                              >
                                <option value="">Seleccionar...</option>
                                {razonesList.map(razon => (
                                  <option key={razon} value={razon}>{razon}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botones de Acción */}
              {itemsSeleccionados.length > 0 && (
                <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAbrirDevolucionModal}
                    className="flex-1 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#D50565' }}
                  >
                    <DollarSign size={18} />
                    <span className="hidden sm:inline">Registrar Devolución ({itemsSeleccionados.length})</span>
                    <span className="sm:hidden">Devolución ({itemsSeleccionados.length})</span>
                  </button>
                  <button
                    onClick={handleAbrirCambioModal}
                    className="flex-1 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#EA5C2E' }}
                  >
                    <RefreshCw size={18} />
                    <span className="hidden sm:inline">Registrar Cambio ({itemsSeleccionados.length})</span>
                    <span className="sm:hidden">Cambio ({itemsSeleccionados.length})</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Historial */}
        {!facturaEncontrada && historial.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Historial Reciente</h2>

            {/* Vista de Tarjetas - Solo Móvil */}
            <div className="md:hidden space-y-3">
              {historial.slice(0, 10).map((registro) => (
                <div key={registro.id} className="border border-gray-300 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{registro.clienteNombre}</p>
                      <p className="text-xs text-gray-500">
                        {registro.createdAt?.toDate?.()?.toLocaleDateString('es-CO') || 'N/A'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      registro.tipo === 'cambio'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-pink-100 text-pink-800'
                    }`}>
                      {registro.tipo === 'cambio' ? 'Cambio' : 'Devolución'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Factura #{registro.numeroFacturaOriginal}</span>
                    <span className="font-bold text-gray-900">
                      ${(registro.montoDevuelto || registro.diferenciaPrecio || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista de Tabla - Solo Desktop */}
            <div className="hidden md:block border border-gray-300 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Factura</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {historial.slice(0, 10).map((registro) => (
                    <tr key={registro.id}>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {registro.createdAt?.toDate?.()?.toLocaleDateString('es-CO') || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">{registro.clienteNombre}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          registro.tipo === 'cambio'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-pink-100 text-pink-800'
                        }`}>
                          {registro.tipo === 'cambio' ? 'Cambio' : 'Devolución'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">#{registro.numeroFacturaOriginal}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                        ${(registro.montoDevuelto || registro.diferenciaPrecio || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL DE DEVOLUCIÓN */}
        {showDevolucionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">Confirmar Devolución</h2>
                <p className="text-gray-600 mt-1">Revisa los detalles antes de confirmar</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Productos a devolver */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Productos a devolver:</h3>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Producto</th>
                          <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Cant.</th>
                          <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Precio</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Razón</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {itemsSeleccionados.map(index => {
                          const item = facturaEncontrada.items[index];
                          const cantidadDevuelta = cantidadesDevueltas[index] || item.cantidad;
                          return (
                            <tr key={index}>
                              <td className="px-4 py-2">
                                <p className="font-medium text-gray-800">{item.nombre || item.product?.nombre}</p>
                                <p className="text-xs text-gray-500">Talla: {item.talla}</p>
                              </td>
                              <td className="px-4 py-2 text-center">{cantidadDevuelta}</td>
                              <td className="px-4 py-2 text-right">
                                ${(cantidadDevuelta * (item.precioUnitario || 0)).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">{razones[index]}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Monto total a devolver */}
                <div className="rounded-lg p-4" style={{ backgroundColor: '#FFF1E5' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-800">Monto total a devolver:</span>
                    <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                      ${calcularMontoDevolucion().toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Método de devolución */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Método de devolución
                  </label>
                  <select
                    value={metodoDevolucion}
                    onChange={(e) => setMetodoDevolucion(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Nequi">Nequi</option>
                    <option value="Daviplata">Daviplata</option>
                    <option value="Nu">Nu</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    value={notasDevolucion}
                    onChange={(e) => setNotasDevolucion(e.target.value)}
                    placeholder="Agregar notas sobre la devolución..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowDevolucionModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarDevolucion}
                  className="flex-1 px-6 py-3 text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#D50565' }}
                >
                  <CheckCircle size={20} />
                  Confirmar Devolución
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CAMBIO */}
        {showCambioModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">Registrar Cambio</h2>
                <p className="text-gray-600 mt-1">Selecciona los productos nuevos para el cambio</p>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Lado izquierdo: Productos devueltos */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <XCircle size={20} style={{ color: '#D50565' }} />
                      Productos que se devuelven:
                    </h3>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-pink-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Producto</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Cant.</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {itemsSeleccionados.map(index => {
                            const item = facturaEncontrada.items[index];
                            const cantidadDevuelta = cantidadesDevueltas[index] || item.cantidad;
                            return (
                              <tr key={index}>
                                <td className="px-3 py-2">
                                  <p className="text-sm font-medium text-gray-800">{item.nombre || item.product?.nombre}</p>
                                  <p className="text-xs text-gray-500">Talla: {item.talla}</p>
                                  <p className="text-xs text-gray-500">{razones[index]}</p>
                                </td>
                                <td className="px-3 py-2 text-center text-sm">{cantidadDevuelta}</td>
                                <td className="px-3 py-2 text-right text-sm font-semibold">
                                  ${(cantidadDevuelta * (item.precioUnitario || 0)).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-pink-50">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-right font-semibold text-gray-800">
                              Total devuelto:
                            </td>
                            <td className="px-3 py-2 text-right font-bold" style={{ color: '#D50565' }}>
                              ${calcularValorDevuelto().toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Lado derecho: Productos nuevos */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Package size={20} style={{ color: '#EA5C2E' }} />
                      Productos nuevos:
                    </h3>

                    {/* Buscador de productos */}
                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          placeholder="Buscar productos..."
                          value={searchProducto}
                          onChange={(e) => setSearchProducto(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      {/* Lista de productos filtrados */}
                      {searchProducto && (
                        <div className="mt-2 border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                          {productosFiltrados.length === 0 ? (
                            <p className="p-4 text-center text-gray-500 text-sm">No se encontraron productos</p>
                          ) : (
                            <div className="divide-y divide-gray-200">
                              {productosFiltrados.map(producto => (
                                <div key={producto.id} className="p-3 hover:bg-gray-50">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm text-gray-800">{producto.nombre}</p>
                                      <p className="text-xs text-gray-500">Ref: {producto.referencia}</p>
                                      <p className="text-xs text-gray-600">Stock: {producto.stockTotal || 0}</p>
                                      <p className="text-sm font-semibold" style={{ color: '#EA5C2E' }}>
                                        ${(producto.precio || 0).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>

                                  {producto.tallas && producto.tallas.length > 0 && (
                                    <select
                                      value={tallasSeleccionadas[producto.id] || producto.tallas[0]}
                                      onChange={(e) => handleTallaChange(producto.id, e.target.value)}
                                      className="w-full px-2 py-1 mb-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                      {producto.tallas.map(talla => (
                                        <option key={talla} value={talla}>{talla}</option>
                                      ))}
                                    </select>
                                  )}

                                  <button
                                    onClick={() => handleAgregarProductoNuevo(producto)}
                                    className="w-full px-3 py-1 text-white rounded text-xs hover:opacity-90"
                                    style={{ backgroundColor: '#EA5C2E' }}
                                  >
                                    Agregar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Carrito de productos nuevos */}
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-orange-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Producto</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Cant.</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Valor</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {productosNuevos.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-8 text-center text-gray-500 text-sm">
                                Agrega productos usando el buscador
                              </td>
                            </tr>
                          ) : (
                            productosNuevos.map((producto, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2">
                                  <p className="text-sm font-medium text-gray-800">{producto.nombre}</p>
                                  <p className="text-xs text-gray-500">Talla: {producto.tallaSeleccionada}</p>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="1"
                                    max={producto.stockDisponible}
                                    value={producto.cantidad}
                                    onChange={(e) => actualizarCantidadProductoNuevo(index, e.target.value)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right text-sm font-semibold">
                                  ${(producto.cantidad * (producto.precio || 0)).toLocaleString()}
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => eliminarProductoNuevo(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {productosNuevos.length > 0 && (
                          <tfoot className="bg-orange-50">
                            <tr>
                              <td colSpan={2} className="px-3 py-2 text-right font-semibold text-gray-800">
                                Total nuevo:
                              </td>
                              <td colSpan={2} className="px-3 py-2 text-right font-bold" style={{ color: '#EA5C2E' }}>
                                ${calcularValorNuevo().toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>

                {/* Cálculo de diferencia */}
                {productosNuevos.length > 0 && (
                  <div className="rounded-lg p-4" style={{ backgroundColor: '#C5D6EF' }}>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Valor devuelto</p>
                        <p className="text-lg font-bold text-gray-800">
                          ${calcularValorDevuelto().toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Valor nuevo</p>
                        <p className="text-lg font-bold text-gray-800">
                          ${calcularValorNuevo().toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Diferencia</p>
                        <p className={`text-xl font-bold ${calcularDiferencia() > 0 ? 'text-green-600' : calcularDiferencia() < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {calcularDiferencia() > 0 ? '+' : ''}${calcularDiferencia().toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {calcularDiferencia() > 0 ? 'Cliente paga' : calcularDiferencia() < 0 ? 'Cliente recibe' : 'Sin diferencia'}
                        </p>
                      </div>
                    </div>

                    {/* Método de pago/devolución si hay diferencia */}
                    {calcularDiferencia() !== 0 && (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Método de {calcularDiferencia() > 0 ? 'pago' : 'devolución'}
                        </label>
                        <select
                          value={metodoPagoDiferencia}
                          onChange={(e) => setMetodoPagoDiferencia(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="Nequi">Nequi</option>
                          <option value="Daviplata">Daviplata</option>
                          <option value="Nu">Nu</option>
                          <option value="Tarjeta">Tarjeta</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    value={notasCambio}
                    onChange={(e) => setNotasCambio(e.target.value)}
                    placeholder="Agregar notas sobre el cambio..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowCambioModal(false);
                    setProductosNuevos([]);
                    setSearchProducto('');
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarCambio}
                  disabled={productosNuevos.length === 0}
                  className="flex-1 px-6 py-3 text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: '#EA5C2E' }}
                >
                  <RefreshCw size={20} />
                  Confirmar Cambio
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE TIRILLA */}
        {showTirillaModal && tirillaData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">
                  {tirillaData.tipo === 'devolucion' ? 'Devolución Registrada' : 'Cambio Registrado'}
                </h2>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div id="tirilla-print" className="bg-white p-4">
                  {/* Header */}
                  <div className="text-center mb-4 pb-3 border-b-2 border-dashed border-gray-400">
                    <h2 className="text-lg font-bold">{companyConfig?.nombre || 'UNIFORMES MARTHA ROMERO'}</h2>
                    {companyConfig?.direccion && (
                      <p className="text-xs">{companyConfig.direccion}</p>
                    )}
                    {companyConfig?.telefono && (
                      <p className="text-xs">Tel: {companyConfig.telefono}</p>
                    )}
                    {companyConfig?.nit && (
                      <p className="text-xs">NIT: {companyConfig.nit}</p>
                    )}
                  </div>

                  {/* Tipo de documento */}
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold">
                      {tirillaData.tipo === 'devolucion' ? 'DEVOLUCIÓN' : 'CAMBIO'}
                    </h3>
                    <p className="text-xs mt-1">
                      {tirillaData.fecha?.toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Info del cliente y factura */}
                  <div className="mb-4 pb-3 border-b border-dashed border-gray-300 text-sm">
                    <p><strong>Cliente:</strong> {tirillaData.clienteNombre}</p>
                    <p><strong>Factura original:</strong> #{tirillaData.numeroFacturaOriginal}</p>
                  </div>

                  {/* Items devueltos */}
                  <div className="mb-4">
                    <h4 className="font-bold text-sm mb-2">
                      {tirillaData.tipo === 'devolucion' ? 'PRODUCTOS DEVUELTOS:' : 'PRODUCTOS DEVUELTOS:'}
                    </h4>
                    <div className="text-xs space-y-2">
                      {tirillaData.itemsDevueltos?.map((item, index) => (
                        <div key={index} className="border-b border-gray-200 pb-2">
                          <div className="flex justify-between">
                            <span className="font-medium">{item.nombre || item.product?.nombre}</span>
                            <span>${(item.subtotal || (item.cantidad * (item.precioUnitario || 0))).toLocaleString()}</span>
                          </div>
                          <div className="text-gray-600">
                            Talla: {item.talla} | Cant: {item.cantidad}
                          </div>
                          <div className="text-gray-600 italic">
                            Razón: {item.razon}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Items nuevos (solo para cambios) */}
                  {tirillaData.tipo === 'cambio' && tirillaData.itemsNuevos && (
                    <div className="mb-4">
                      <h4 className="font-bold text-sm mb-2">PRODUCTOS NUEVOS:</h4>
                      <div className="text-xs space-y-2">
                        {tirillaData.itemsNuevos.map((item, index) => (
                          <div key={index} className="border-b border-gray-200 pb-2">
                            <div className="flex justify-between">
                              <span className="font-medium">{item.nombre}</span>
                              <span>${(item.subtotal || 0).toLocaleString()}</span>
                            </div>
                            <div className="text-gray-600">
                              Talla: {item.talla} | Cant: {item.cantidad}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Totales */}
                  <div className="mb-4 pt-3 border-t-2 border-gray-400">
                    {tirillaData.tipo === 'devolucion' ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between font-bold">
                          <span>TOTAL DEVUELTO:</span>
                          <span>${(tirillaData.montoDevuelto || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Método:</span>
                          <span>{tirillaData.metodoDevolucion}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Valor devuelto:</span>
                          <span>${(tirillaData.valorDevuelto || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor nuevo:</span>
                          <span>${(tirillaData.valorNuevo || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t border-gray-300">
                          <span>DIFERENCIA:</span>
                          <span className={tirillaData.tipoDiferencia === 'cliente_paga' ? 'text-green-600' : tirillaData.tipoDiferencia === 'cliente_recibe' ? 'text-red-600' : ''}>
                            {tirillaData.tipoDiferencia === 'cliente_paga' ? '+' : tirillaData.tipoDiferencia === 'cliente_recibe' ? '-' : ''}
                            ${(tirillaData.diferenciaPrecio || 0).toLocaleString()}
                          </span>
                        </div>
                        {tirillaData.tipoDiferencia !== 'sin_diferencia' && (
                          <div className="flex justify-between text-xs">
                            <span>Método:</span>
                            <span>{tirillaData.metodoPagoDiferencia || tirillaData.metodoDevolucionDiferencia}</span>
                          </div>
                        )}
                        <div className="text-xs text-center mt-2 italic">
                          {tirillaData.tipoDiferencia === 'cliente_paga' && '(Cliente paga diferencia)'}
                          {tirillaData.tipoDiferencia === 'cliente_recibe' && '(Cliente recibe diferencia)'}
                          {tirillaData.tipoDiferencia === 'sin_diferencia' && '(Sin diferencia)'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notas */}
                  {tirillaData.notas && (
                    <div className="mb-4 text-xs">
                      <p className="font-bold">Notas:</p>
                      <p className="text-gray-600">{tirillaData.notas}</p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="text-center text-xs pt-3 border-t border-dashed border-gray-300">
                    <p className="mb-2">¡Gracias por su preferencia!</p>
                    <p className="text-gray-500">Este documento es un comprobante de {tirillaData.tipo === 'devolucion' ? 'devolución' : 'cambio'}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowTirillaModal(false);
                    setTirillaData(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cerrar
                </button>
                <button
                  onClick={handlePrintTirilla}
                  className="flex-1 px-6 py-3 text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2"
                  style={{ backgroundColor: tirillaData.tipo === 'devolucion' ? '#D50565' : '#EA5C2E' }}
                >
                  <Printer size={20} />
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN DE HISTORIAL */}
        {!facturaEncontrada && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mt-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-6">
              Historial de Cambios y Devoluciones
            </h2>

            {/* Estadísticas Rápidas */}
            {historial.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <XCircle className="text-red-600" size={24} />
                    <div>
                      <p className="text-xs text-red-700 font-medium">Total Devoluciones</p>
                      <p className="text-xl font-bold text-red-800">
                        {historial.filter(h => h.tipo === 'devolucion').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="text-blue-600" size={24} />
                    <div>
                      <p className="text-xs text-blue-700 font-medium">Total Cambios</p>
                      <p className="text-xl font-bold text-blue-800">
                        {historial.filter(h => h.tipo === 'cambio').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="text-purple-600" size={24} />
                    <div>
                      <p className="text-xs text-purple-700 font-medium">Total Devuelto</p>
                      <p className="text-xl font-bold text-purple-800">
                        ${historial
                          .filter(h => h.tipo === 'devolucion')
                          .reduce((sum, h) => sum + (h.montoDevuelto || 0), 0)
                          .toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Historial */}
            {historial.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package size={48} className="mx-auto mb-3 opacity-50" />
                <p>No hay cambios o devoluciones registradas</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {(() => {
                    // Calcular paginación
                    const indiceInicio = (paginaActualHistorial - 1) * registrosPorPagina;
                    const indiceFin = indiceInicio + registrosPorPagina;
                    const registrosPaginados = historial.slice(indiceInicio, indiceFin);

                    return registrosPaginados.map((registro) => (
                    <div
                      key={registro.id}
                      className={`border rounded-lg overflow-hidden ${
                        registro.tipo === 'devolucion'
                          ? 'border-red-200 bg-red-50'
                          : 'border-blue-200 bg-blue-50'
                      }`}
                    >
                      {/* Header del registro */}
                      <div
                        className="p-4 cursor-pointer hover:bg-opacity-70"
                        onClick={() => toggleRegistroExpandido(registro.id)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  registro.tipo === 'devolucion'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                {registro.tipo === 'devolucion' ? '🔄 DEVOLUCIÓN' : '🔁 CAMBIO'}
                              </span>
                              <span className="text-sm font-semibold text-gray-800">
                                Factura #{registro.numeroFactura}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">
                              Cliente: {registro.clienteNombre}
                            </p>
                            <p className="text-xs text-gray-600">
                              {registro.createdAt?.toDate?.()?.toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) || 'Fecha no disponible'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            {registro.tipo === 'devolucion' && (
                              <div className="text-right">
                                <p className="text-xs text-gray-600">Monto devuelto</p>
                                <p className="text-lg font-bold text-red-700">
                                  ${(registro.montoDevuelto || 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {registro.metodoDevolucion}
                                </p>
                              </div>
                            )}
                            {registro.tipo === 'cambio' && (
                              <div className="text-right">
                                <p className="text-xs text-gray-600">Diferencia</p>
                                <p className={`text-lg font-bold ${
                                  registro.tipoDiferencia === 'cliente_paga'
                                    ? 'text-green-700'
                                    : registro.tipoDiferencia === 'cliente_recibe'
                                    ? 'text-red-700'
                                    : 'text-gray-700'
                                }`}>
                                  {registro.tipoDiferencia === 'cliente_paga' && '+'}
                                  {registro.tipoDiferencia === 'cliente_recibe' && '-'}
                                  ${(registro.diferenciaPrecio || 0).toLocaleString()}
                                </p>
                                {registro.tipoDiferencia !== 'sin_diferencia' && (
                                  <p className="text-xs text-gray-500">
                                    {registro.metodoPagoDiferencia || registro.metodoDevolucionDiferencia}
                                  </p>
                                )}
                              </div>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTirillaData(registro);
                                setShowTirillaModal(true);
                              }}
                              className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                              title="Reimprimir comprobante"
                            >
                              <Printer size={16} />
                              <span className="hidden sm:inline">Imprimir</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Detalles expandibles */}
                      {registrosExpandidos[registro.id] && (
                        <div className="border-t border-gray-300 bg-white p-4 space-y-4">
                          {/* Productos devueltos/cambiados */}
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <XCircle size={16} className="text-red-600" />
                              Productos {registro.tipo === 'devolucion' ? 'Devueltos' : 'Cambiados'}:
                            </h4>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Producto</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Cant</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Precio</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Razón</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {registro.itemsDevueltos?.map((item, idx) => (
                                    <tr key={idx} className="bg-white">
                                      <td className="px-3 py-2">
                                        <p className="font-medium text-gray-800">
                                          {item.nombre || item.product?.nombre}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                          Talla: {item.talla} | Ref: {item.referencia || item.product?.referencia}
                                        </p>
                                        {item.razon === 'Defecto de fabricación' && (
                                          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded mt-1">
                                            ⚠️ Defectuoso
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-center font-medium">
                                        {item.cantidad}
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium">
                                        ${(item.precioUnitario || 0).toLocaleString()}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-600">
                                        {item.razon}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Productos nuevos (solo en cambios) */}
                          {registro.tipo === 'cambio' && registro.productosNuevos?.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-600" />
                                Productos Nuevos Entregados:
                              </h4>
                              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Producto</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Cant</th>
                                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Precio</th>
                                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {registro.productosNuevos.map((item, idx) => (
                                      <tr key={idx} className="bg-white">
                                        <td className="px-3 py-2">
                                          <p className="font-medium text-gray-800">{item.nombre}</p>
                                          <p className="text-xs text-gray-600">
                                            Talla: {item.talla} | Ref: {item.referencia}
                                          </p>
                                        </td>
                                        <td className="px-3 py-2 text-center font-medium">
                                          {item.cantidad}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                          ${(item.precio || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold">
                                          ${((item.precio || 0) * item.cantidad).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Notas */}
                          {registro.notas && (
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2">Notas:</h4>
                              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                {registro.notas}
                              </p>
                            </div>
                          )}

                          {/* Información adicional */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                            <div>
                              <p className="text-xs text-gray-600">Procesado por:</p>
                              <p className="text-sm font-medium text-gray-800">
                                {registro.userId || 'Usuario no registrado'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">ID de registro:</p>
                              <p className="text-sm font-mono text-gray-800">
                                {registro.id.substring(0, 8)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    ));
                  })()}
                </div>

                {/* Paginación */}
                {historial.length > registrosPorPagina && (
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Mostrando {((paginaActualHistorial - 1) * registrosPorPagina) + 1} - {Math.min(paginaActualHistorial * registrosPorPagina, historial.length)} de {historial.length} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPaginaActualHistorial(prev => Math.max(prev - 1, 1))}
                        disabled={paginaActualHistorial === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        ← Anterior
                      </button>
                      <span className="text-sm text-gray-600">
                        Pág. {paginaActualHistorial} de {Math.ceil(historial.length / registrosPorPagina)}
                      </span>
                      <button
                        onClick={() => setPaginaActualHistorial(prev => Math.min(prev + 1, Math.ceil(historial.length / registrosPorPagina)))}
                        disabled={paginaActualHistorial === Math.ceil(historial.length / registrosPorPagina)}
                        className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Estilos de impresión para tirilla de 80mm */}
      <style>
        {`
          @media print {
            /* Configuración de página para impresora térmica */
            @page {
              size: 80mm auto;
              margin: 0;
            }

            html, body {
              width: 80mm !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              overflow: visible !important;
            }

            /* Ocultar todo el contenido excepto el ticket */
            body * {
              visibility: hidden !important;
            }

            /* Mostrar solo el recibo y sus hijos */
            #tirilla-print,
            #tirilla-print * {
              visibility: visible !important;
            }

            /* Posicionar el recibo */
            #tirilla-print {
              position: absolute !important;
              left: 4mm !important;
              top: 0 !important;
              width: 72mm !important;
              margin: 0 !important;
              padding: 2mm 4mm !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              font-size: 11pt !important;
              line-height: 1.4 !important;
              color: black !important;
            }

            /* Asegurar que todo el contenido sea visible */
            #tirilla-print * {
              max-width: 100% !important;
              color: black !important;
            }

            /* Optimizar colores para impresión */
            #tirilla-print {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            /* Asegurar que las tablas se vean bien */
            #tirilla-print table {
              width: 100% !important;
              border-collapse: collapse !important;
            }

            #tirilla-print table td,
            #tirilla-print table th {
              padding: 1mm 0 !important;
              font-size: 10pt !important;
            }

            /* Líneas divisoras */
            #tirilla-print .border-dashed {
              border-style: dashed !important;
              border-color: #000 !important;
            }

            #tirilla-print .border-t {
              border-top-width: 1px !important;
            }

            #tirilla-print .border-b {
              border-bottom-width: 1px !important;
            }

            /* Evitar saltos de página */
            #tirilla-print {
              page-break-inside: avoid !important;
            }

            #tirilla-print table {
              page-break-inside: auto !important;
            }

            #tirilla-print tr {
              page-break-inside: avoid !important;
              page-break-after: auto !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Devoluciones;
