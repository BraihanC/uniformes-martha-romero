import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion, serverTimestamp, query, orderBy, addDoc, where, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Package, DollarSign, CheckCircle, Clock, Eye, Plus, Calendar, CreditCard, User, Building, Truck, ClipboardCheck, ShoppingBag, Trash2, Search } from 'lucide-react';

const PedidosB2B = () => {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [montoAbono, setMontoAbono] = useState('');
  const [notasAbono, setNotasAbono] = useState('');
  const [showAlistarModal, setShowAlistarModal] = useState(false);
  const [productoAlistar, setProductoAlistar] = useState(null);
  const [cantidadAlistar, setCantidadAlistar] = useState('');

  // Estados para crear pedido desde tienda
  const [showCrearPedidoModal, setShowCrearPedidoModal] = useState(false);
  const [clientesCorporativos, setClientesCorporativos] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [carritoTienda, setCarritoTienda] = useState([]);
  const [notasPedidoTienda, setNotasPedidoTienda] = useState('');
  const [creandoPedido, setCreandoPedido] = useState(false);
  const [cargandoProductos, setCargandoProductos] = useState(false);

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

  const formatDateShort = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
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
        aprobadoPor: user?.displayName || user?.email || 'Administrador',
        fechaAprobacion: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Crear notificación para el cliente
      await crearNotificacion(
        pedido,
        'pedido_estado',
        'Pedido Aprobado',
        `Tu pedido #${String(pedido.numeroPedido || 0).padStart(4, '0')} ha sido aprobado y está en preparación.`
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
        fecha: new Date(),
        registradoPor: user?.displayName || user?.email || 'Administrador',
        notas: notasAbono.trim()
      };

      await updateDoc(pedidoRef, {
        abonos: arrayUnion(nuevoAbono),
        updatedAt: serverTimestamp()
      });

      // Calcular nuevo saldo
      const nuevoSaldo = calcularSaldoPendiente(selectedPedido.total, [...(selectedPedido.abonos || []), nuevoAbono]);

      // Crear registro en transacciones_b2b para contabilidad separada
      await addDoc(collection(db, 'transacciones_b2b'), {
        tipo: 'abono_pedido_b2b',
        pedidoId: selectedPedido.id,
        numeroPedido: selectedPedido.numeroPedido || 0,
        clienteId: selectedPedido.clienteId || '',
        clienteNombre: selectedPedido.clienteNombre || '',
        codigoColegio: selectedPedido.codigoColegio || '',
        monto: monto,
        metodoPago: 'No especificado',
        referencia: '',
        notas: notasAbono.trim(),
        totalPedido: selectedPedido.total || 0,
        saldoPendiente: nuevoSaldo,
        createdAt: serverTimestamp(),
        createdBy: user?.displayName || user?.email || 'Administrador'
      });

      // Crear notificación para el cliente
      await crearNotificacion(
        selectedPedido,
        'abono_registrado',
        'Pago Registrado',
        `Se ha registrado un pago de ${formatCurrency(monto)} en tu pedido #${String(selectedPedido.numeroPedido || 0).padStart(4, '0')}. Saldo pendiente: ${formatCurrency(nuevoSaldo)}`
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

  const handleAlistarProducto = async () => {
    const cantidad = parseInt(cantidadAlistar);
    const cantidadPendiente = productoAlistar.cantidad - (productoAlistar.cantidadAlistada || 0);

    if (!cantidad || cantidad <= 0) {
      alert('Ingresa una cantidad válida');
      return;
    }

    if (cantidad > cantidadPendiente) {
      alert(`No puedes alistar más de ${cantidadPendiente} unidades`);
      return;
    }

    try {
      const pedidoRef = doc(db, 'pedidos_b2b', selectedPedido.id);

      // Actualizar el producto específico
      const productosActualizados = selectedPedido.productos.map((p, idx) => {
        if (idx === productoAlistar.index) {
          const nuevaCantidadAlistada = (p.cantidadAlistada || 0) + cantidad;
          return {
            ...p,
            cantidadAlistada: nuevaCantidadAlistada,
            estadoProduccion: nuevaCantidadAlistada >= p.cantidad ? 'alistado' : 'pendiente',
            fechaAlistado: new Date()
          };
        }
        return p;
      });

      await updateDoc(pedidoRef, {
        productos: productosActualizados,
        updatedAt: serverTimestamp()
      });

      // Actualizar selectedPedido localmente para reflejar cambios inmediatamente en el modal
      setSelectedPedido({
        ...selectedPedido,
        productos: productosActualizados
      });

      alert(`${cantidad} unidad(es) de ${productoAlistar.descripcion} alistada(s) exitosamente`);
      setShowAlistarModal(false);
      setCantidadAlistar('');
      setProductoAlistar(null);
      fetchPedidos();
    } catch (error) {
      console.error('Error al alistar producto:', error);
      alert('Error al alistar producto: ' + error.message);
    }
  };

  const handleEnviarProductosAlistados = async () => {
    // Verificar que hay productos alistados
    const productosAlistados = selectedPedido.productos.filter(p =>
      (p.cantidadAlistada || 0) > (p.cantidadEnviada || 0)
    );

    if (productosAlistados.length === 0) {
      alert('No hay productos alistados para enviar');
      return;
    }

    // Calcular si el envío es completo o parcial
    const todosEnviados = selectedPedido.productos.every(p =>
      (p.cantidadAlistada || 0) >= p.cantidad
    );

    const tipoEnvio = todosEnviados ? 'completo' : 'parcial';
    const nuevoEstado = todosEnviados ? 'Enviado' : 'Enviado Parcial';

    // Mostrar confirmación con detalle
    const detalleProductos = productosAlistados.map(p => {
      const cantidadAEnviar = (p.cantidadAlistada || 0) - (p.cantidadEnviada || 0);
      return `- ${p.descripcion} (Talla ${p.talla}): ${cantidadAEnviar} unidad(es)`;
    }).join('\n');

    const mensaje = `¿Confirmar envío ${tipoEnvio}?\n\nProductos a enviar:\n${detalleProductos}`;

    if (!window.confirm(mensaje)) return;

    try {
      const pedidoRef = doc(db, 'pedidos_b2b', selectedPedido.id);

      // Actualizar productos: mover cantidadAlistada a cantidadEnviada
      const productosActualizados = selectedPedido.productos.map(p => {
        const cantidadAEnviar = Math.max(0, (p.cantidadAlistada || 0) - (p.cantidadEnviada || 0));
        if (cantidadAEnviar > 0) {
          const nuevaCantidadEnviada = (p.cantidadEnviada || 0) + cantidadAEnviar;
          return {
            ...p,
            cantidadEnviada: nuevaCantidadEnviada,
            estadoProduccion: nuevaCantidadEnviada >= p.cantidad ? 'enviado' : 'pendiente',
            fechaEnvio: new Date()
          };
        }
        return p;
      });

      await updateDoc(pedidoRef, {
        productos: productosActualizados,
        estado: nuevoEstado,
        updatedAt: serverTimestamp()
      });

      // Actualizar selectedPedido localmente para reflejar cambios inmediatamente
      setSelectedPedido({
        ...selectedPedido,
        productos: productosActualizados,
        estado: nuevoEstado
      });

      // Crear notificación para el cliente
      const totalUnidadesEnviadas = productosAlistados.reduce((sum, p) => {
        return sum + ((p.cantidadAlistada || 0) - (p.cantidadEnviada || 0));
      }, 0);

      await crearNotificacion(
        selectedPedido,
        'productos_enviados',
        `Productos Enviados - ${tipoEnvio === 'completo' ? 'Envío Completo' : 'Envío Parcial'}`,
        `Se han enviado ${totalUnidadesEnviadas} unidad(es) de tu pedido #${String(selectedPedido.numeroPedido || 0).padStart(4, '0')}. Revisa el detalle en el portal.`
      );

      alert(`Productos enviados exitosamente (${tipoEnvio})`);
      setShowDetalleModal(false);
      fetchPedidos();
    } catch (error) {
      console.error('Error al enviar productos:', error);
      alert('Error al enviar productos: ' + error.message);
    }
  };

  // Funciones para crear pedido desde tienda
  const fetchClientesCorporativos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'clientes_corporativos'));
      const clientes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientesCorporativos(clientes);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      alert('Error al cargar clientes: ' + error.message);
    }
  };

  const fetchProductosDisponibles = async (codigoColegio, clienteId) => {
    try {
      setCargandoProductos(true);

      // Cargar productos B2B del colegio específico
      const productosRef = collection(db, 'products');
      const productosQuery = query(
        productosRef,
        where('colegio', '==', codigoColegio),
        where('esB2B', '==', true)
      );
      const productosSnapshot = await getDocs(productosQuery);

      const productos = productosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Cargar precios corporativos si existen
      if (clienteId) {
        const preciosRef = collection(db, 'precios_corporativos');
        const preciosQuery = query(
          preciosRef,
          where('clienteId', '==', clienteId)
        );
        const preciosSnapshot = await getDocs(preciosQuery);

        const preciosMap = {};
        preciosSnapshot.forEach(doc => {
          const data = doc.data();
          preciosMap[data.productoId] = data.precioEspecial;
        });

        // Aplicar precios corporativos a los productos
        const productosConPrecios = productos.map(p => ({
          ...p,
          precioMostrar: preciosMap[p.id] || p.precio || 0
        }));

        setProductosDisponibles(productosConPrecios);
      } else {
        setProductosDisponibles(productos);
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
      alert('Error al cargar productos: ' + error.message);
    } finally {
      setCargandoProductos(false);
    }
  };

  const handleAbrirModalCrearPedido = () => {
    fetchClientesCorporativos();
    setShowCrearPedidoModal(true);
  };

  const handleSeleccionarCliente = async (clienteId) => {
    const cliente = clientesCorporativos.find(c => c.id === clienteId);
    setClienteSeleccionado(cliente);

    // Limpiar carrito y búsqueda al cambiar de cliente
    setCarritoTienda([]);
    setProductosDisponibles([]);
    setBusquedaProducto('');

    if (cliente && cliente.codigoColegio) {
      // Cargar productos del colegio específico con precios corporativos
      await fetchProductosDisponibles(cliente.codigoColegio, cliente.id);
    }
  };

  // Función para ordenar productos por talla
  const ordenarPorTalla = (productos) => {
    const ordenTallas = {
      '4': 1, '6': 2, '8': 3, '10': 4, '12': 5, '14': 6, '16': 7,
      'S': 8, 'M': 9, 'L': 10, 'XL': 11, 'XXL': 12,
      'SX': 8, 'XS': 8
    };

    return [...productos].sort((a, b) => {
      const tallaA = (a.talla || '').toUpperCase().trim();
      const tallaB = (b.talla || '').toUpperCase().trim();

      const ordenA = ordenTallas[tallaA] || 999;
      const ordenB = ordenTallas[tallaB] || 999;

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      // Si tienen el mismo orden, ordenar alfabéticamente
      return tallaA.localeCompare(tallaB);
    });
  };

  const handleAgregarAlCarrito = (producto, talla, cantidad) => {
    if (!producto || !talla || !cantidad || cantidad <= 0) {
      alert('Completa todos los campos');
      return;
    }

    // Usar precio corporativo si existe, si no usar precio regular
    const precioFinal = producto.precioMostrar || producto.precio || 0;

    const itemExistente = carritoTienda.find(
      item => item.productoId === producto.id && item.talla === talla
    );

    if (itemExistente) {
      setCarritoTienda(carritoTienda.map(item =>
        item.productoId === producto.id && item.talla === talla
          ? { ...item, cantidad: item.cantidad + cantidad, subtotal: (item.cantidad + cantidad) * item.precioUnitario }
          : item
      ));
    } else {
      setCarritoTienda([...carritoTienda, {
        productoId: producto.id,
        codigo: producto.codigo,
        descripcion: producto.nombre, // Usar 'nombre' en lugar de 'descripcion'
        talla: talla,
        cantidad: cantidad,
        precioUnitario: precioFinal,
        subtotal: precioFinal * cantidad,
        tipo: producto.tipo || '',
        categoria: producto.categoria || ''
      }]);
    }
  };

  const handleEliminarDelCarrito = (index) => {
    setCarritoTienda(carritoTienda.filter((_, i) => i !== index));
  };

  const calcularTotalCarrito = () => {
    return carritoTienda.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleCrearPedidoDesdeTienda = async () => {
    if (!clienteSeleccionado) {
      alert('Selecciona un cliente');
      return;
    }

    if (carritoTienda.length === 0) {
      alert('Agrega productos al pedido');
      return;
    }

    if (!window.confirm('¿Confirmar la creación de este pedido desde tienda?')) {
      return;
    }

    setCreandoPedido(true);
    try {
      // Obtener el número de pedido consecutivo
      const q = query(collection(db, 'pedidos_b2b'), orderBy('numeroPedido', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      let nextNumero = 1;
      if (!snapshot.empty) {
        const lastPedido = snapshot.docs[0].data();
        nextNumero = (lastPedido.numeroPedido || 0) + 1;
      }

      // Crear el pedido
      const pedidoData = {
        numeroPedido: nextNumero,
        clienteId: clienteSeleccionado.id,
        clienteNombre: clienteSeleccionado.nombre,
        codigoColegio: clienteSeleccionado.codigoColegio,
        productos: carritoTienda.map(item => ({
          ...item,
          cantidadAlistada: 0,
          cantidadEnviada: 0,
          cantidadRecibida: 0,
          estadoProduccion: 'pendiente',
          fechaAlistado: null,
          fechaEnvio: null,
          fechaRecepcion: null
        })),
        total: calcularTotalCarrito(),
        notas: notasPedidoTienda.trim(),
        estado: 'Pendiente',
        origenPedido: 'tienda', // Distintivo especial
        creadoPor: user?.displayName || user?.email || 'Admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const pedidoRef = await addDoc(collection(db, 'pedidos_b2b'), pedidoData);

      // Crear notificación para el cliente
      await addDoc(collection(db, 'notificaciones_portal'), {
        clienteId: clienteSeleccionado.id,
        tipo: 'pedido_tienda',
        titulo: 'Nuevo Pedido Creado en Tienda',
        mensaje: `Se ha creado el pedido #${String(nextNumero).padStart(4, '0')} en tienda por ${formatCurrency(calcularTotalCarrito())}. Este pedido requería medidas especiales.`,
        leida: false,
        pedidoId: pedidoRef.id,
        createdAt: serverTimestamp()
      });

      alert(`¡Pedido #${String(nextNumero).padStart(4, '0')} creado exitosamente desde tienda!`);

      // Limpiar y cerrar
      setCarritoTienda([]);
      setClienteSeleccionado(null);
      setNotasPedidoTienda('');
      setBusquedaProducto('');
      setProductosDisponibles([]);
      setShowCrearPedidoModal(false);
      fetchPedidos();
    } catch (error) {
      console.error('Error al crear pedido:', error);
      alert('Error al crear pedido: ' + error.message);
    } finally {
      setCreandoPedido(false);
    }
  };

  const getEstadoBadgeColor = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'En Preparación':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Enviado Parcial':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Enviado':
        return 'bg-purple-100 text-purple-800 border-purple-300';
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
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Package size={24} className="md:w-7 md:h-7" style={{ color: '#D50565' }} />
              <span>Pedidos B2B</span>
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              {pedidos.length} {pedidos.length === 1 ? 'pedido registrado' : 'pedidos registrados'}
            </p>
          </div>
          <button
            onClick={handleAbrirModalCrearPedido}
            className="flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors font-medium"
            style={{ backgroundColor: '#D50565' }}
          >
            <ShoppingBag size={20} />
            <span>Crear Pedido desde Tienda</span>
          </button>
        </div>
      </div>

      {/* Lista de Pedidos */}
      {pedidos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package size={48} className="md:w-16 md:h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-base md:text-lg font-semibold text-gray-700 mb-2">
            No hay pedidos B2B registrados
          </h3>
        </div>
      ) : (
        <>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
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
                            #{String(pedido.numeroPedido || 0).padStart(4, '0')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{pedido.clienteNombre}</div>
                          <div className="text-xs text-gray-500">{pedido.codigoColegio}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateShort(pedido.createdAt)}
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

          {/* Vista Mobile/Tablet - Cards */}
          <div className="lg:hidden space-y-4">
            {pedidos.map((pedido) => {
              const totalAbonado = calcularTotalAbonado(pedido.abonos);
              const saldoPendiente = calcularSaldoPendiente(pedido.total, pedido.abonos);
              const estadoPago = calcularEstadoPago(pedido.total, pedido.abonos);

              return (
                <div
                  key={pedido.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden border-l-4"
                  style={{ borderColor: '#D50565' }}
                >
                  {/* Header de la Card */}
                  <div className="p-4 bg-gray-50 border-b">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800">
                          #{String(pedido.numeroPedido || 0).padStart(4, '0')}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                          <User size={14} />
                          <span>{pedido.clienteNombre}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Building size={12} />
                          <span>{pedido.codigoColegio}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getEstadoBadgeColor(pedido.estado)}`}>
                          {pedido.estado}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border flex items-center gap-1 ${getEstadoPagoBadgeColor(estadoPago)}`}>
                          <CreditCard size={10} />
                          {estadoPago}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                      <Calendar size={12} />
                      <span>{formatDateShort(pedido.createdAt)}</span>
                    </div>
                  </div>

                  {/* Información Financiera */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600 mb-1">Total</p>
                        <p className="text-sm font-bold text-gray-800">
                          {formatCurrency(pedido.total)}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600 mb-1">Abonado</p>
                        <p className="text-sm font-bold text-green-600">
                          {formatCurrency(totalAbonado)}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600 mb-1">Saldo</p>
                        <p className="text-sm font-bold text-orange-600">
                          {formatCurrency(saldoPendiente)}
                        </p>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setSelectedPedido(pedido);
                          setShowDetalleModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye size={16} />
                        Ver Detalle
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPedido(pedido);
                          setShowAbonoModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Plus size={16} />
                        Registrar Abono
                      </button>
                    </div>

                    {/* Botón Aprobar (solo si está pendiente) */}
                    {pedido.estado === 'Pendiente' && !pedido.aprobado && (
                      <button
                        onClick={() => handleAprobarPedido(pedido)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <CheckCircle size={16} />
                        Aprobar Pedido
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Detalle Pedido */}
      {showDetalleModal && selectedPedido && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 md:px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                Detalle Pedido #{String(selectedPedido.numeroPedido || 0).padStart(4, '0')}
              </h2>
              <button
                onClick={() => setShowDetalleModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {/* Info Cliente */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Información del Cliente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
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

              {/* Productos con Control de Producción */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">Productos</h3>
                  {/* Botón Enviar Productos Alistados */}
                  {selectedPedido.productos?.some(p => (p.cantidadAlistada || 0) > (p.cantidadEnviada || 0)) && (() => {
                    // Calcular si todos los productos están completamente alistados
                    const todosAlistados = selectedPedido.productos.every(p =>
                      (p.cantidadAlistada || 0) >= p.cantidad
                    );
                    const textoBoton = todosAlistados ? 'Enviar Pedido Completo' : 'Enviar Productos Alistados (Parcial)';

                    return (
                      <button
                        onClick={handleEnviarProductosAlistados}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 transition-colors"
                        style={{ backgroundColor: '#D50565' }}
                      >
                        <Truck size={16} />
                        {textoBoton}
                      </button>
                    );
                  })()}
                </div>
                <div className="space-y-3">
                  {selectedPedido.productos?.map((producto, index) => {
                    const cantidadPedida = producto.cantidad || 0;
                    const cantidadAlistada = producto.cantidadAlistada || 0;
                    const cantidadEnviada = producto.cantidadEnviada || 0;
                    const cantidadPendienteAlistar = cantidadPedida - cantidadAlistada;

                    return (
                      <div key={index} className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                        {/* Header del Producto */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-sm md:text-base">
                              {producto.descripcion}
                            </p>
                            <p className="text-xs md:text-sm text-gray-500 mt-1">
                              Talla: {producto.talla} • Código: {producto.codigo}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold text-gray-800 text-sm md:text-base">
                              {formatCurrency(producto.subtotal)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(producto.precioUnitario)} c/u
                            </p>
                          </div>
                        </div>

                        {/* Estado y Cantidades */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                          <div className="bg-white rounded-lg p-2 text-center border">
                            <p className="text-xs text-gray-500">Pedidas</p>
                            <p className="text-lg font-bold text-gray-800">{cantidadPedida}</p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
                            <p className="text-xs text-blue-600">Alistadas</p>
                            <p className="text-lg font-bold text-blue-700">{cantidadAlistada}</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-200">
                            <p className="text-xs text-purple-600">Enviadas</p>
                            <p className="text-lg font-bold text-purple-700">{cantidadEnviada}</p>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-200">
                            <p className="text-xs text-orange-600">Pendientes</p>
                            <p className="text-lg font-bold text-orange-700">{cantidadPendienteAlistar}</p>
                          </div>
                        </div>

                        {/* Botón Alistar */}
                        {cantidadPendienteAlistar > 0 && (
                          <button
                            onClick={() => {
                              setProductoAlistar({ ...producto, index });
                              setCantidadAlistar(cantidadPendienteAlistar.toString());
                              setShowAlistarModal(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <ClipboardCheck size={16} />
                            Alistar Producto
                          </button>
                        )}

                        {/* Badge de estado completo */}
                        {cantidadAlistada >= cantidadPedida && (
                          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg py-1">
                            <CheckCircle size={14} />
                            Producto completamente alistado
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
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
                          <div className="text-left sm:text-right">
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
                  <div className="flex justify-between text-base md:text-lg font-bold border-t pt-2">
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-white border-b px-4 md:px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">Registrar Abono</h2>
              <button
                onClick={() => {
                  setShowAbonoModal(false);
                  setMontoAbono('');
                  setNotasAbono('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {/* Info del Pedido */}
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  Pedido: <span className="font-semibold">#{String(selectedPedido.numeroPedido || 0).padStart(4, '0')}</span>
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
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
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
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAbonoModal(false);
                    setMontoAbono('');
                    setNotasAbono('');
                  }}
                  className="w-full sm:flex-1 px-4 py-2 text-sm md:text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegistrarAbono}
                  className="w-full sm:flex-1 px-4 py-2 text-sm md:text-base text-white rounded-lg hover:opacity-90"
                  style={{ backgroundColor: '#D50565' }}
                >
                  Registrar Abono
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alistar Producto */}
      {showAlistarModal && productoAlistar && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-white border-b px-4 md:px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">Alistar Producto</h2>
              <button
                onClick={() => {
                  setShowAlistarModal(false);
                  setCantidadAlistar('');
                  setProductoAlistar(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {/* Info del Producto */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  {productoAlistar.descripcion}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Talla:</span>
                    <span className="ml-2 font-medium">{productoAlistar.talla}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Código:</span>
                    <span className="ml-2 font-medium">{productoAlistar.codigo}</span>
                  </div>
                </div>
              </div>

              {/* Estado Actual */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm">Estado Actual</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-600">Pedidas</p>
                    <p className="font-bold text-gray-800">{productoAlistar.cantidad}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Alistadas</p>
                    <p className="font-bold text-blue-700">{productoAlistar.cantidadAlistada || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Pendientes</p>
                    <p className="font-bold text-orange-700">
                      {productoAlistar.cantidad - (productoAlistar.cantidadAlistada || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cantidad a Alistar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad a Alistar *
                </label>
                <input
                  type="number"
                  value={cantidadAlistar}
                  onChange={(e) => setCantidadAlistar(e.target.value)}
                  min="1"
                  max={productoAlistar.cantidad - (productoAlistar.cantidadAlistada || 0)}
                  placeholder="0"
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Máximo: {productoAlistar.cantidad - (productoAlistar.cantidadAlistada || 0)} unidades
                </p>
              </div>

              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAlistarModal(false);
                    setCantidadAlistar('');
                    setProductoAlistar(null);
                  }}
                  className="w-full sm:flex-1 px-4 py-2 text-sm md:text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAlistarProducto}
                  className="w-full sm:flex-1 px-4 py-2 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Confirmar Alistado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Pedido desde Tienda */}
      {showCrearPedidoModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Crear Pedido B2B desde Tienda</h2>
              <button
                onClick={() => {
                  setShowCrearPedidoModal(false);
                  setCarritoTienda([]);
                  setClienteSeleccionado(null);
                  setNotasPedidoTienda('');
                  setBusquedaProducto('');
                  setProductosDisponibles([]);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Seleccionar Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente Corporativo *
                </label>
                <select
                  value={clienteSeleccionado?.id || ''}
                  onChange={(e) => handleSeleccionarCliente(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                >
                  <option value="">-- Selecciona un cliente --</option>
                  {clientesCorporativos.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre} - {cliente.codigoColegio}
                    </option>
                  ))}
                </select>
                {clienteSeleccionado && cargandoProductos && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#D50565' }}></div>
                    <p className="text-sm text-gray-600">
                      Cargando productos B2B del colegio: {clienteSeleccionado.codigoColegio}...
                    </p>
                  </div>
                )}
                {clienteSeleccionado && !cargandoProductos && productosDisponibles.length > 0 && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ {productosDisponibles.length} productos disponibles
                  </p>
                )}
              </div>

              {/* Agregar Productos */}
              {clienteSeleccionado && !cargandoProductos && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Agregar Productos</h3>
                  {productosDisponibles.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                      <Package size={48} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-600">No hay productos B2B disponibles para este colegio</p>
                    </div>
                  ) : (
                    <>
                      {/* Campo de Búsqueda */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Buscar producto
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                          <input
                            type="text"
                            value={busquedaProducto}
                            onChange={(e) => setBusquedaProducto(e.target.value)}
                            placeholder="Busca por nombre, talla o categoría..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                          />
                        </div>
                        {!busquedaProducto && (
                          <p className="text-sm text-gray-500 mt-2">
                            Escribe para buscar productos disponibles
                          </p>
                        )}
                      </div>

                      {/* Lista de Productos Filtrados - Solo aparece cuando hay búsqueda */}
                      {busquedaProducto && (() => {
                        const productosFiltrados = ordenarPorTalla(
                          productosDisponibles.filter(producto =>
                            producto.nombre?.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
                            producto.talla?.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
                            producto.categoria?.toLowerCase().includes(busquedaProducto.toLowerCase())
                          )
                        );

                        if (productosFiltrados.length === 0) {
                          return (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                              <Package size={48} className="mx-auto text-gray-300 mb-3" />
                              <p className="text-gray-500">No se encontraron productos con "{busquedaProducto}"</p>
                            </div>
                          );
                        }

                        return (
                          <div className="border border-gray-200 rounded-lg">
                            {/* Lista scrolleable con altura fija */}
                            <div
                              className="space-y-2 p-2"
                              style={{ maxHeight: '360px', overflowY: 'auto' }}
                            >
                              {productosFiltrados.map(producto => (
                                <div
                                  key={producto.id}
                                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-800">{producto.nombre}</h4>
                                    <p className="text-sm text-gray-600">
                                      Talla: {producto.talla} • {producto.categoria} • {formatCurrency(producto.precioMostrar || producto.precio || 0)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      defaultValue="1"
                                      id={`cantidad-${producto.id}`}
                                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                    <button
                                      onClick={() => {
                                        const cantidad = parseInt(document.getElementById(`cantidad-${producto.id}`).value) || 1;
                                        handleAgregarAlCarrito(producto, producto.talla, cantidad);
                                        document.getElementById(`cantidad-${producto.id}`).value = '1';
                                      }}
                                      className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors flex items-center gap-1"
                                      style={{ backgroundColor: '#D50565' }}
                                    >
                                      <Plus size={16} />
                                      Agregar
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Contador de resultados */}
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600 text-center">
                              {productosFiltrados.length} {productosFiltrados.length === 1 ? 'producto encontrado' : 'productos encontrados'}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* Carrito */}
              {carritoTienda.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Productos en el Pedido ({carritoTienda.length})
                  </h3>
                  <div className="space-y-2">
                    {carritoTienda.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{item.descripcion}</p>
                          <p className="text-sm text-gray-600">
                            Talla: {item.talla} • Cantidad: {item.cantidad} • {formatCurrency(item.precioUnitario)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-semibold text-gray-800">{formatCurrency(item.subtotal)}</p>
                          <button
                            onClick={() => handleEliminarDelCarrito(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-800">Total:</span>
                    <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                      {formatCurrency(calcularTotalCarrito())}
                    </span>
                  </div>
                </div>
              )}

              {/* Notas */}
              {carritoTienda.length > 0 && (
                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas del Pedido (Opcional)
                  </label>
                  <textarea
                    value={notasPedidoTienda}
                    onChange={(e) => setNotasPedidoTienda(e.target.value)}
                    placeholder="Ej: Medidas especiales tomadas en tienda..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                  />
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCrearPedidoModal(false);
                    setCarritoTienda([]);
                    setClienteSeleccionado(null);
                    setNotasPedidoTienda('');
                    setBusquedaProducto('');
                    setProductosDisponibles([]);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  disabled={creandoPedido}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCrearPedidoDesdeTienda}
                  className="flex-1 px-6 py-3 text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#D50565' }}
                  disabled={creandoPedido || !clienteSeleccionado || carritoTienda.length === 0}
                >
                  {creandoPedido ? 'Creando...' : 'Crear Pedido'}
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
