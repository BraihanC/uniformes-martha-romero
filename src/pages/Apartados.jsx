import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
  increment,
  limit,
  deleteDoc,
  where,
  addDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  Eye,
  Printer,
  Calendar,
  DollarSign,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Clock,
  Phone,
  Trash2,
  Loader2
} from 'lucide-react';

const Apartados = () => {
  const { currentUser, isAdmin } = useAuth();

  // Estados principales
  const [apartados, setApartados] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estados de modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showAbonoReceiptModal, setShowAbonoReceiptModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showMetodoPagoModal, setShowMetodoPagoModal] = useState(false);
  const [selectedApartado, setSelectedApartado] = useState(null);
  const [lastAbono, setLastAbono] = useState(null);
  const [facturaData, setFacturaData] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [montoPagoFactura, setMontoPagoFactura] = useState(0);
  const [metodoPagoFactura, setMetodoPagoFactura] = useState('Efectivo');

  // Estados para crear apartado
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [selectedColegioId, setSelectedColegioId] = useState('');
  const [colegios, setColegios] = useState([]);
  const [searchCliente, setSearchCliente] = useState('');
  const [searchProducto, setSearchProducto] = useState('');
  const [selectedProductos, setSelectedProductos] = useState([]);
  const [tallasSeleccionadas, setTallasSeleccionadas] = useState({});
  const [plazoSeleccionado, setPlazoSeleccionado] = useState(5);
  const [abonoInicial, setAbonoInicial] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [notasApartado, setNotasApartado] = useState('');

  // Estados para gestión de apartado
  const [nuevoAbono, setNuevoAbono] = useState('');
  const [notasAbono, setNotasAbono] = useState('');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState('Efectivo');

  // Estados para corrección de productos en apartados
  const [showCorreccionProductoModal, setShowCorreccionProductoModal] = useState(false);
  const [itemIndexToCorrect, setItemIndexToCorrect] = useState(null);
  const [searchProductoCorreccion, setSearchProductoCorreccion] = useState('');
  const [productoNuevoSeleccionado, setProductoNuevoSeleccionado] = useState(null);
  const [nuevaCantidadCorreccion, setNuevaCantidadCorreccion] = useState(1);
  const [notasCorreccion, setNotasCorreccion] = useState('');
  const [corrigiendoProducto, setCorrigiendoProducto] = useState(false);

  // Estados para anulación de productos en apartados
  const [showAnularProductoModal, setShowAnularProductoModal] = useState(false);
  const [itemIndexToAnular, setItemIndexToAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulandoProducto, setAnulandoProducto] = useState(false);

  // Estados para creación rápida de cliente
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nombreCompleto: '',
    tipoDocumento: 'Cédula de Ciudadanía',
    numeroDocumento: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    colegioId: ''
  });

  // Tipos de documento disponibles
  const tiposDocumento = [
    'Cédula de Ciudadanía',
    'NIT',
    'Cédula de Extranjería',
    'Tarjeta de Identidad'
  ];

  // Estados para cambio de método de pago de abono
  const [showCambiarMetodoPagoAbonoModal, setShowCambiarMetodoPagoAbonoModal] = useState(false);
  const [abonoIndexToEdit, setAbonoIndexToEdit] = useState(null);
  const [nuevoMetodoPagoAbono, setNuevoMetodoPagoAbono] = useState('');
  const [notasMetodoPagoAbono, setNotasMetodoPagoAbono] = useState('');
  const [cambiandoMetodoPagoAbono, setCambiandoMetodoPagoAbono] = useState(false);

  // Estados para prevenir doble clic en operaciones críticas
  const [creandoApartado, setCreandoApartado] = useState(false);
  const [registrandoAbono, setRegistrandoAbono] = useState(false);
  const [cancelandoApartado, setCancelandoApartado] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      if (currentUser) {
        setLoading(true);
        setAuthError(null);

        await Promise.all([
          fetchApartados(),
          fetchProductos(),
          fetchClientes(),
          fetchColegios(),
          fetchCompanyConfig()
        ]);

        setLoading(false);
      } else {
        setAuthError('No hay usuario autenticado. Por favor inicia sesión.');
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // Verificar vencimientos automáticamente
  useEffect(() => {
    const verificarVencimientos = async () => {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const apartadosActivos = apartados.filter(
        a => a.estadoGeneral === 'Activo' && a.fechaLimite
      );

      for (const apartado of apartadosActivos) {
        const fechaLimite = apartado.fechaLimite.toDate();
        fechaLimite.setHours(0, 0, 0, 0);

        if (fechaLimite < hoy) {
          const apartadoRef = doc(db, 'apartados', apartado.id);
          await updateDoc(apartadoRef, {
            estadoGeneral: 'Vencido',
            updatedAt: serverTimestamp()
          });
        }
      }
    };

    if (currentUser && apartados.length > 0) {
      verificarVencimientos();
    }
  }, [apartados, currentUser]);

  const fetchApartados = async () => {
    try {
      const q = query(collection(db, 'apartados'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const apartadosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setApartados(apartadosData);
    } catch (error) {
      console.error('Error al cargar apartados:', error.code);

      if (error.code === 'permission-denied') {
        setAuthError('Error de permisos en Firebase. Verifica las reglas de seguridad en Firestore.');
      }
    }
  };

  const fetchProductos = async () => {
    try {
      const productosRef = collection(db, 'products');
      const snapshot = await getDocs(productosRef);

      const productosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setProductos(productosData);
    } catch (error) {
      console.error('Error al cargar productos:', error.code);

      if (error.code === 'permission-denied') {
        setAuthError('Error de permisos en Firebase. Verifica las reglas de seguridad en Firestore.');
      }
    }
  };

  const fetchClientes = async () => {
    try {
      const clientesRef = collection(db, 'clients');
      const snapshot = await getDocs(clientesRef);

      const clientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setClientes(clientesData);
    } catch (error) {
      console.error('Error al cargar clientes:', error.code);

      if (error.code === 'permission-denied') {
        setAuthError('Error de permisos en Firebase. Verifica las reglas de seguridad en Firestore.');
      }
    }
  };

  const fetchColegios = async () => {
    try {
      const colegiosRef = collection(db, 'colegios');
      const snapshot = await getDocs(colegiosRef);

      const colegiosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setColegios(colegiosData);
    } catch (error) {
      console.error('Error al cargar colegios:', error);
    }
  };

  const fetchCompanyConfig = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'config'));

      if (!snapshot.empty) {
        const config = snapshot.docs[0].data();
        setCompanyConfig(config);
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error.code);
      // No mostramos error crítico si falla la configuración
    }
  };

  // Funciones auxiliares
  const calcularDiasRestantes = (fechaLimite) => {
    if (!fechaLimite) return null;
    const hoy = new Date();
    const limite = fechaLimite.toDate();
    const diferencia = Math.ceil((limite - hoy) / (1000 * 60 * 60 * 24));
    return diferencia;
  };

  const getColorDiasRestantes = (dias) => {
    if (dias === null) return 'text-gray-500';
    if (dias < 0) return 'text-red-600 font-bold';
    if (dias <= 5) return 'text-red-500 font-semibold';
    if (dias <= 10) return 'text-yellow-600 font-semibold';
    return 'text-green-600';
  };

  const getEstadoBadgeColor = (estado) => {
    const colors = {
      'Activo': 'bg-blue-100 text-blue-800',
      'Completado': 'bg-green-100 text-green-800',
      'Vencido': 'bg-red-100 text-red-800',
      'Cancelado': 'bg-gray-100 text-gray-800'
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  // Función para ordenar productos por talla
  const ordenarPorTalla = (productos) => {
    const ordenTallas = {
      '4': 1, '6': 2, '8': 3, '10': 4, '12': 5, '14': 6, '16': 7,
      'XS': 8, 'S': 9, 'M': 10, 'L': 11, 'XL': 12, 'XXL': 13,
      'SX': 8
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

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(cliente => {
    const searchLower = searchCliente.toLowerCase();
    return (
      cliente.nombre?.toLowerCase().includes(searchLower) ||
      cliente.nombreCompleto?.toLowerCase().includes(searchLower) ||
      cliente.telefono?.includes(searchCliente) ||
      cliente.documento?.includes(searchCliente) ||
      cliente.numeroDocumento?.includes(searchCliente)
    );
  });

  // Filtrar productos
  const productosFiltrados = ordenarPorTalla(
    productos.filter(producto => {
      const disponible = (producto.stockTotal || 0) - (producto.stockReservadoPedidos || 0) - (producto.stockReservadoApartados || 0) - (producto.stockReservadoB2B || 0);
      const stockDisponible = Math.max(0, disponible); // Nunca muestra negativos
      const matchSearch = producto.nombre?.toLowerCase().includes(searchProducto.toLowerCase()) ||
                         producto.referencia?.toLowerCase().includes(searchProducto.toLowerCase());

      // Si hay un colegio seleccionado, filtrar por colegio
      if (selectedColegioId && selectedColegioId !== 'GENERAL') {
        // Buscar el colegio seleccionado para obtener su código
        const colegioSeleccionado = colegios.find(c => c.id === selectedColegioId);
        const codigoColegio = colegioSeleccionado?.codigo || selectedColegioId;

        // Incluir productos del colegio seleccionado O productos OT (generales)
        const colegioMatch = producto.colegio === codigoColegio || producto.colegio === 'OT';
        return matchSearch && stockDisponible > 0 && colegioMatch;
      }

      return matchSearch && stockDisponible > 0;
    })
  );

  // Agregar producto al apartado
  const agregarProducto = (producto) => {
    const disponible = (producto.stockTotal || 0) - (producto.stockReservadoPedidos || 0) - (producto.stockReservadoApartados || 0) - (producto.stockReservadoB2B || 0);
    const stockDisponible = Math.max(0, disponible); // Nunca muestra negativos

    if (stockDisponible <= 0) {
      alert('No hay stock disponible para este producto');
      return;
    }

    const tallaKey = `${producto.id}`;
    const tallaSeleccionada = tallasSeleccionadas[tallaKey] || producto.tallas?.[0] || 'Única';

    const productoExistente = selectedProductos.find(
      p => p.id === producto.id && p.tallaSeleccionada === tallaSeleccionada
    );

    if (productoExistente) {
      alert('Este producto con esta talla ya está agregado');
      return;
    }

    setSelectedProductos([...selectedProductos, {
      id: producto.id,
      nombre: producto.nombre,
      referencia: producto.referencia,
      tallaSeleccionada: tallaSeleccionada,
      cantidad: 1,
      precioUnitario: producto.precio || 0,
      stockDisponible: stockDisponible
    }]);
  };

  const handleTallaChange = (productoId, talla) => {
    setTallasSeleccionadas(prev => ({
      ...prev,
      [productoId]: talla
    }));
  };

  const actualizarCantidadProducto = (index, nuevaCantidad) => {
    const cantidad = parseInt(nuevaCantidad) || 0;
    const producto = selectedProductos[index];

    if (cantidad > producto.stockDisponible) {
      alert(`Solo hay ${producto.stockDisponible} unidades disponibles`);
      return;
    }

    if (cantidad < 1) {
      eliminarProducto(index);
      return;
    }

    const nuevosProductos = [...selectedProductos];
    nuevosProductos[index].cantidad = cantidad;
    setSelectedProductos(nuevosProductos);
  };

  const eliminarProducto = (index) => {
    setSelectedProductos(selectedProductos.filter((_, i) => i !== index));
  };

  const calcularTotales = () => {
    const subtotal = selectedProductos.reduce(
      (sum, p) => sum + (p.cantidad * p.precioUnitario), 0
    );
    return { subtotal };
  };

  // Crear cliente rápido
  const handleCreateClient = async () => {
    // Validar campos requeridos
    if (!newClientData.nombreCompleto.trim()) {
      alert('Por favor, ingresa el nombre completo del cliente.');
      return;
    }
    if (!newClientData.numeroDocumento.trim()) {
      alert('Por favor, ingresa el número de documento del cliente.');
      return;
    }

    setLoading(true);
    try {
      const newClient = {
        nombreCompleto: newClientData.nombreCompleto.trim(),
        tipoDocumento: newClientData.tipoDocumento,
        numeroDocumento: newClientData.numeroDocumento.trim(),
        telefono: newClientData.telefono.trim(),
        email: newClientData.email.trim(),
        direccion: newClientData.direccion.trim(),
        ciudad: newClientData.ciudad.trim(),
        colegioId: newClientData.colegioId || null,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'clients'), newClient);
      const clientWithId = { id: docRef.id, ...newClient };

      // Actualizar lista de clientes
      setClientes([...clientes, clientWithId]);

      // Seleccionar el cliente recién creado
      setSelectedClienteId(clientWithId.id);
      setSearchCliente(clientWithId.nombreCompleto);

      // Cerrar modal y limpiar formulario
      setShowClientModal(false);
      setNewClientData({
        nombreCompleto: '',
        tipoDocumento: 'Cédula de Ciudadanía',
        numeroDocumento: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: '',
        colegioId: ''
      });

      alert('Cliente creado exitosamente');
    } catch (error) {
      console.error('Error al crear cliente:', error);
      alert('Error al crear el cliente. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Crear apartado
  const handleCrearApartado = async () => {
    if (!selectedClienteId) {
      alert('Selecciona un cliente');
      return;
    }

    if (selectedProductos.length === 0) {
      alert('Agrega al menos un producto');
      return;
    }

    const { subtotal } = calcularTotales();
    const abono = parseFloat(abonoInicial) || 0;

    if (abono > subtotal) {
      alert('El abono inicial no puede ser mayor al total');
      return;
    }

    // Prevenir doble clic
    if (creandoApartado) return;
    setCreandoApartado(true);

    try {
      const cliente = clientes.find(c => c.id === selectedClienteId);
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + plazoSeleccionado);

      const historialAbonos = abono > 0 ? [{
        fecha: new Date(),
        monto: abono,
        notas: 'Abono inicial',
        metodoPago: metodoPago
      }] : [];

      // Obtener el siguiente número consecutivo
      const apartadosSnapshot = await getDocs(query(collection(db, 'apartados'), orderBy('numeroApartado', 'desc'), limit(1)));
      let siguienteNumero = 1;
      if (!apartadosSnapshot.empty) {
        const ultimoApartado = apartadosSnapshot.docs[0].data();
        siguienteNumero = (ultimoApartado.numeroApartado || 0) + 1;
      }

      const colegio = colegios.find(c => c.id === selectedColegioId);
      const colegioNombre = colegio ? colegio.nombre : '';

      const nuevoApartado = {
        numeroApartado: siguienteNumero,
        clienteId: selectedClienteId,
        clienteNombre: cliente.nombreCompleto || cliente.nombre || 'Sin nombre',
        clienteTelefono: cliente.telefono || '',
        clienteDocumento: cliente.numeroDocumento || cliente.documento || '',
        colegioId: selectedColegioId || '',
        colegioNombre: colegioNombre,
        items: selectedProductos.map(p => ({
          productoId: p.id,
          nombre: p.nombre,
          referencia: p.referencia,
          talla: p.tallaSeleccionada,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario,
          subtotal: p.cantidad * p.precioUnitario
        })),
        totalApartado: subtotal,
        totalAbonado: abono,
        saldoPendiente: subtotal - abono,
        plazoOriginalDias: plazoSeleccionado,
        diasExtendidos: 0,
        fechaLimite: fechaLimite,
        estadoGeneral: 'Activo',
        historialAbonos: historialAbonos,
        notas: notasApartado,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Usar batch para actualizar inventario y crear apartado
      const batch = writeBatch(db);

      // Crear el apartado
      const apartadoRef = doc(collection(db, 'apartados'));
      batch.set(apartadoRef, nuevoApartado);

      // Actualizar inventario (reservar stock)
      for (const producto of selectedProductos) {
        const productoRef = doc(db, 'products', producto.id);
        batch.update(productoRef, {
          stockReservadoApartados: increment(producto.cantidad)
        });
      }

      // 4. (NUEVO) Registrar Transacción de Abono Inicial
      if (abono > 0) {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'abono_apartado',
          monto: abono,
          metodoPago: metodoPago,
          apartadoId: apartadoRef.id,
          numeroApartado: siguienteNumero,
          descripcion: `Abono inicial Apartado #${siguienteNumero}`,
          clienteId: selectedClienteId,
          clienteNombre: cliente.nombreCompleto || cliente.nombre,
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });
      }

      await batch.commit();

      alert('Apartado creado exitosamente');
      resetCreateForm();
      setShowCreateModal(false);
      fetchApartados();
      fetchProductos();

    } catch (error) {
      console.error('Error al crear apartado:', error);
      alert('Error al crear apartado');
    } finally {
      setCreandoApartado(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedClienteId('');
    setSelectedColegioId('');
    setSearchCliente('');
    setSearchProducto('');
    setSelectedProductos([]);
    setTallasSeleccionadas({});
    setPlazoSeleccionado(5);
    setAbonoInicial('0');
    setMetodoPago('Efectivo');
    setNotasApartado('');
  };

  // Registrar abono (VERSIÓN ATÓMICA MEJORADA)
  const handleRegistrarAbono = async () => {
    // Validar estado del apartado
    if (selectedApartado.estadoGeneral === 'Completado') {
      alert('⚠️ Este apartado ya está completado. No se pueden agregar más abonos.');
      return;
    }

    if (selectedApartado.estadoGeneral === 'Cancelado') {
      alert('⚠️ Este apartado está cancelado. No se pueden agregar abonos.');
      return;
    }

    const monto = parseFloat(nuevoAbono);

    if (!monto || monto <= 0) {
      alert('Ingresa un monto válido');
      return;
    }

    if (monto > selectedApartado.saldoPendiente) {
      alert('El abono no puede ser mayor al saldo pendiente');
      return;
    }

    // Prevenir doble clic
    if (registrandoAbono) return;
    setRegistrandoAbono(true);

    setLoading(true); // Activar loading
    try {
      const batch = writeBatch(db);
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);

      const nuevoTotalAbonado = selectedApartado.totalAbonado + monto;
      const nuevoSaldoPendiente = selectedApartado.totalApartado - nuevoTotalAbonado;
      const estaCompletado = nuevoSaldoPendiente <= 0; // Más seguro que === 0

      const nuevoHistorial = {
        fecha: new Date().toISOString(), // Usar ISO string para historial
        monto: monto,
        notas: notasAbono || '',
        metodoPago: metodoPagoAbono
      };

      const updatedHistorial = [...(selectedApartado.historialAbonos || []), nuevoHistorial];

      // 1. Actualizar el Apartado en el Batch
      batch.update(apartadoRef, {
        totalAbonado: nuevoTotalAbonado,
        saldoPendiente: nuevoSaldoPendiente,
        estadoGeneral: estaCompletado ? 'Completado' : 'Activo',
        historialAbonos: updatedHistorial,
        updatedAt: serverTimestamp()
      });

      // 2. (NUEVO) Registrar la Transacción del Abono
      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, {
        tipo: 'abono_apartado',
        monto: monto,
        metodoPago: metodoPagoAbono,
        apartadoId: selectedApartado.id,
        numeroApartado: selectedApartado.numeroApartado,
        descripcion: `Abono Apartado #${selectedApartado.numeroApartado || selectedApartado.id.substring(0, 5)}`,
        clienteId: selectedApartado.clienteId,
        clienteNombre: selectedApartado.clienteNombre,
        fecha: serverTimestamp(),
        userId: currentUser.uid
      });

      // 3. (LÓGICA DE CONVERTIRAVENTA INTEGRADA) Si se completa, crear Venta y actualizar Stock
      if (estaCompletado) {
        // Crear la venta
        const ventaData = {
          clienteId: selectedApartado.clienteId,
          clienteNombre: selectedApartado.clienteNombre,
          items: selectedApartado.items,
          subtotal: selectedApartado.totalApartado,
          descuento: 0,
          totalPagado: selectedApartado.totalApartado,
          metodoPago: 'Apartado Completado',
          notas: `Venta generada desde apartado completado. ${selectedApartado.notas || ''}`,
          apartadoId: selectedApartado.id,
          esFacturaDeApartado: true,
          createdAt: serverTimestamp(),
          userId: currentUser.uid
          // Nota: Falta numeroFactura consecutivo, se puede añadir luego si es crítico
        };
        const ventaRef = doc(collection(db, 'sales'));
        batch.set(ventaRef, ventaData);

        // Actualizar el apartado con el ID de la venta
        batch.update(apartadoRef, { facturaId: ventaRef.id });

        // Actualizar inventario (decrementar stock y liberar reserva)
        // IMPORTANTE: Solo procesar productos NO anulados y que aún existan
        const productosNoEncontrados = [];
        for (const item of selectedApartado.items) {
          if (item.anulado) continue; // Saltar productos anulados (ya liberaron su reserva)

          const productoRef = doc(db, 'products', item.productoId);

          // Verificar si el producto existe antes de actualizarlo
          const productoSnap = await getDoc(productoRef);
          if (!productoSnap.exists()) {
            productosNoEncontrados.push(item.nombre || item.productoId);
            continue; // Saltar productos que ya no existen
          }

          batch.update(productoRef, {
            stockTotal: increment(-item.cantidad),
            stockReservadoApartados: increment(-item.cantidad)
          });
        }

        // Advertir sobre productos no encontrados (pero continuar)
        if (productosNoEncontrados.length > 0) {
          console.warn('Productos no encontrados en inventario:', productosNoEncontrados);
        }
      }

      // 4. Commit Atómico
      await batch.commit();

      // 5. Preparar Modal de Recibo
      setLastAbono({
        monto: monto,
        fecha: new Date(),
        notas: notasAbono || '',
        apartado: selectedApartado,
        nuevoSaldoPendiente: nuevoSaldoPendiente,
        nuevoTotalAbonado: nuevoTotalAbonado
      });

      setNuevoAbono('');
      setNotasAbono('');
      setMetodoPagoAbono('Efectivo');
      fetchApartados(); // Refrescar lista
      if(estaCompletado) {
        fetchProductos(); // Refrescar stock si se completó
      }

      // Actualizar el estado local
      const updatedApartado = {
        ...selectedApartado,
        totalAbonado: nuevoTotalAbonado,
        saldoPendiente: nuevoSaldoPendiente,
        estadoGeneral: estaCompletado ? 'Completado' : 'Activo',
        historialAbonos: updatedHistorial
      };
      setSelectedApartado(updatedApartado);
      setShowAbonoReceiptModal(true);

      if (estaCompletado) {
        alert('¡Apartado completado y convertido a venta!');
      }

    } catch (error) {
      console.error('Error al registrar abono:', error);
      alert('Error al registrar abono: ' + error.message);
    } finally {
      setLoading(false); // Desactivar loading
      setRegistrandoAbono(false);
    }
  };

  // Extender plazo
  const handleExtenderPlazo = async (diasExtension) => {
    if (!selectedApartado) return;

    try {
      const nuevaFechaLimite = selectedApartado.fechaLimite.toDate();
      nuevaFechaLimite.setDate(nuevaFechaLimite.getDate() + diasExtension);

      const apartadoRef = doc(db, 'apartados', selectedApartado.id);
      await updateDoc(apartadoRef, {
        fechaLimite: nuevaFechaLimite,
        diasExtendidos: selectedApartado.diasExtendidos + diasExtension,
        estadoGeneral: 'Activo', // Reactivar si estaba vencido
        updatedAt: serverTimestamp()
      });

      alert(`Plazo extendido por ${diasExtension} días`);
      fetchApartados();

      const updatedApartado = {
        ...selectedApartado,
        fechaLimite: { toDate: () => nuevaFechaLimite },
        diasExtendidos: selectedApartado.diasExtendidos + diasExtension,
        estadoGeneral: 'Activo'
      };
      setSelectedApartado(updatedApartado);

    } catch (error) {
      console.error('Error al extender plazo:', error);
      alert('Error al extender plazo');
    }
  };

  // Cancelar apartado
  const handleCancelarApartado = async () => {
    if (!selectedApartado) return;

    const confirmar = window.confirm(
      `¿Estás seguro de cancelar este apartado?\n\n` +
      `Cliente: ${selectedApartado.clienteNombre}\n` +
      `Total: $${selectedApartado.totalApartado.toLocaleString()}\n` +
      `Abonado: $${selectedApartado.totalAbonado.toLocaleString()}\n\n` +
      `Los productos volverán a estar disponibles en inventario.`
    );

    if (!confirmar) return;

    // Prevenir doble clic
    if (cancelandoApartado) return;
    setCancelandoApartado(true);

    try {
      const batch = writeBatch(db);

      // Actualizar estado del apartado
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);
      batch.update(apartadoRef, {
        estadoGeneral: 'Cancelado',
        fechaCancelacion: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Liberar inventario reservado
      // IMPORTANTE: Solo liberar productos NO anulados (los anulados ya liberaron su reserva)
      for (const item of selectedApartado.items) {
        if (item.anulado) continue; // Saltar productos anulados

        const productoRef = doc(db, 'products', item.productoId);
        batch.update(productoRef, {
          stockReservadoApartados: increment(-item.cantidad)
        });
      }

      await batch.commit();

      alert('Apartado cancelado exitosamente. El inventario ha sido liberado.');
      setShowManageModal(false);
      setSelectedApartado(null);
      fetchApartados();
      fetchProductos();

    } catch (error) {
      console.error('Error al cancelar apartado:', error);
      alert('Error al cancelar apartado');
    } finally {
      setCancelandoApartado(false);
    }
  };

  // Eliminar apartado completamente (incluye transacciones)
  const handleEliminarApartado = async () => {
    if (!selectedApartado) return;

    const confirmar = window.confirm(
      `⚠️ ELIMINAR PERMANENTEMENTE\n\n` +
      `¿Estás seguro de ELIMINAR este apartado?\n\n` +
      `Cliente: ${selectedApartado.clienteNombre}\n` +
      `Total: $${selectedApartado.totalApartado.toLocaleString()}\n` +
      `Abonado: $${selectedApartado.totalAbonado.toLocaleString()}\n\n` +
      `Esta acción:\n` +
      `• Eliminará el apartado de la base de datos\n` +
      `• Eliminará todas las transacciones de abonos asociadas\n` +
      `• Liberará el inventario reservado\n\n` +
      `Esta acción NO se puede deshacer.`
    );

    if (!confirmar) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Buscar y eliminar transacciones asociadas
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('apartadoId', '==', selectedApartado.id)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);

      let transaccionesEliminadas = 0;
      transactionsSnapshot.docs.forEach(transactionDoc => {
        batch.delete(transactionDoc.ref);
        transaccionesEliminadas++;
      });

      // 2. Liberar inventario reservado (si el apartado no estaba completado o cancelado)
      if (selectedApartado.estadoGeneral === 'Activo' || selectedApartado.estadoGeneral === 'Vencido') {
        // IMPORTANTE: Solo liberar productos NO anulados (los anulados ya liberaron su reserva)
        for (const item of selectedApartado.items) {
          if (item.anulado) continue; // Saltar productos anulados

          const productoRef = doc(db, 'products', item.productoId);
          batch.update(productoRef, {
            stockReservadoApartados: increment(-item.cantidad)
          });
        }
      }

      // 3. Eliminar el documento del apartado
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);
      batch.delete(apartadoRef);

      await batch.commit();

      alert(
        `Apartado eliminado exitosamente.\n\n` +
        `• ${transaccionesEliminadas} transacción(es) eliminada(s)\n` +
        `• Inventario liberado`
      );

      setShowManageModal(false);
      setSelectedApartado(null);
      fetchApartados();
      fetchProductos();

    } catch (error) {
      console.error('Error al eliminar apartado:', error);
      alert('Error al eliminar apartado: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Funciones para corrección de productos en apartados
  const handleOpenCorreccionProducto = (itemIndex) => {
    setItemIndexToCorrect(itemIndex);
    setShowCorreccionProductoModal(true);
    setSearchProductoCorreccion('');
    setProductoNuevoSeleccionado(null);
    setNuevaCantidadCorreccion(selectedApartado.items[itemIndex].cantidad); // Inicializar con cantidad actual
    setNotasCorreccion('');
  };

  const handleCloseCorreccionProducto = () => {
    setShowCorreccionProductoModal(false);
    setItemIndexToCorrect(null);
    setSearchProductoCorreccion('');
    setProductoNuevoSeleccionado(null);
    setNuevaCantidadCorreccion(1);
    setNotasCorreccion('');
  };

  const handleCorregirProductoApartado = async () => {
    if (!selectedApartado || itemIndexToCorrect === null) {
      return;
    }

    if (!notasCorreccion.trim()) {
      alert('Por favor, ingresa las notas explicando el motivo de la corrección.');
      return;
    }

    // Validar que la nueva cantidad sea válida
    const cantidadNueva = parseInt(nuevaCantidadCorreccion);
    if (!cantidadNueva || cantidadNueva <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    const itemActual = selectedApartado.items[itemIndexToCorrect];
    const cantidadAnterior = itemActual.cantidad;

    // Si no se seleccionó producto nuevo, usar el actual
    const productoParaUsar = productoNuevoSeleccionado || itemActual;
    const cambioDeProducto = productoNuevoSeleccionado && itemActual.productoId !== productoNuevoSeleccionado.id;
    const cambioDeCantidad = cantidadNueva !== cantidadAnterior;

    // Validar que haya al menos un cambio
    if (!cambioDeProducto && !cambioDeCantidad) {
      alert('No hay cambios para aplicar. Modifica el producto o la cantidad.');
      return;
    }

    // Mensaje de confirmación personalizado
    let mensajeConfirmacion = `⚠️ CORREGIR APARTADO\n\nApartado #${selectedApartado.numeroApartado}\n\n`;

    if (cambioDeProducto && cambioDeCantidad) {
      mensajeConfirmacion += `Producto anterior: ${itemActual.nombre} (${cantidadAnterior} unidades)\n`;
      mensajeConfirmacion += `Producto nuevo: ${productoParaUsar.nombre} (${cantidadNueva} unidades)\n`;
    } else if (cambioDeProducto) {
      mensajeConfirmacion += `Cambio de producto:\n`;
      mensajeConfirmacion += `  De: ${itemActual.nombre}\n`;
      mensajeConfirmacion += `  A: ${productoParaUsar.nombre}\n`;
      mensajeConfirmacion += `Cantidad: ${cantidadNueva} unidades\n`;
    } else {
      mensajeConfirmacion += `Producto: ${itemActual.nombre}\n`;
      mensajeConfirmacion += `Cantidad anterior: ${cantidadAnterior} unidades\n`;
      mensajeConfirmacion += `Cantidad nueva: ${cantidadNueva} unidades\n`;
    }

    mensajeConfirmacion += `\nEsta acción:\n`;
    mensajeConfirmacion += `• Modificará el apartado\n`;
    mensajeConfirmacion += `• Ajustará el inventario reservado automáticamente\n`;
    mensajeConfirmacion += `• Actualizará el valor total\n\n`;
    mensajeConfirmacion += `¿Continuar?`;

    const confirmar = window.confirm(mensajeConfirmacion);

    if (!confirmar) return;

    setCorrigiendoProducto(true);
    try {
      const batch = writeBatch(db);
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);

      // Producto a usar (nuevo o el mismo)
      const productoNuevoId = productoParaUsar.id || productoParaUsar.productoId || itemActual.productoId;
      const precioNuevo = productoParaUsar.precio || 0;
      const subtotalNuevo = (precioNuevo || 0) * (cantidadNueva || 0);

      // Crear copia de items actualizada
      const updatedItems = [...selectedApartado.items];
      updatedItems[itemIndexToCorrect] = {
        productoId: productoNuevoId || '',
        nombre: productoParaUsar.nombre || '',
        referencia: productoParaUsar.referencia || itemActual.referencia || '',
        talla: productoParaUsar.talla || itemActual.talla || '',
        precio: precioNuevo || 0,
        cantidad: cantidadNueva || 0,
        subtotal: subtotalNuevo || 0
      };

      // Recalcular total del apartado
      const nuevoTotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const nuevoSaldoPendiente = nuevoTotal - (selectedApartado.totalAbonado || 0);

      // Ajustar inventario
      if (!cambioDeProducto) {
        // Mismo producto, solo cambió la cantidad
        const diferenciaCantidad = cantidadNueva - cantidadAnterior;
        if (diferenciaCantidad !== 0) {
          const productoRef = doc(db, 'products', itemActual.productoId);
          batch.update(productoRef, {
            stockReservadoApartados: increment(diferenciaCantidad),
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Productos diferentes
        // Liberar stock del producto anterior
        const productoAnteriorRef = doc(db, 'products', itemActual.productoId);
        batch.update(productoAnteriorRef, {
          stockReservadoApartados: increment(-cantidadAnterior),
          updatedAt: serverTimestamp()
        });

        // Reservar stock del producto nuevo
        const productoNuevoRef = doc(db, 'products', productoNuevoId);
        batch.update(productoNuevoRef, {
          stockReservadoApartados: increment(cantidadNueva),
          updatedAt: serverTimestamp()
        });
      }

      // Actualizar el apartado
      batch.update(apartadoRef, {
        items: updatedItems,
        totalApartado: nuevoTotal || 0,
        saldoPendiente: nuevoSaldoPendiente || 0,
        correccion: {
          fecha: serverTimestamp(),
          itemIndex: itemIndexToCorrect || 0,
          productoAnterior: `${itemActual.nombre || 'Producto'} (${cantidadAnterior || 0} unidades)`,
          productoNuevo: `${productoParaUsar.nombre || 'Producto'} (${cantidadNueva || 0} unidades)`,
          notas: notasCorreccion || ''
        },
        updatedAt: serverTimestamp()
      });

      // Verificar si necesitamos crear transacción de ajuste
      const totalAnterior = selectedApartado.totalApartado;
      const totalAbonado = selectedApartado.totalAbonado || 0;

      // Solo crear transacción si nuevo total < total abonado (hay exceso de pago)
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;

        // Crear transacción de egreso/devolución con la fecha ACTUAL (cuando sale el dinero de caja)
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'egreso',
          monto: diferenciaExceso,
          metodoPago: 'Ajuste',
          apartadoId: selectedApartado.id,
          numeroApartado: selectedApartado.numeroApartado,
          descripcion: `Egreso por corrección Apartado #${selectedApartado.numeroApartado}: Total abonado ($${totalAbonado.toLocaleString()}) excede nuevo total ($${nuevoTotal.toLocaleString()})`,
          notas: `Corrección: ${itemActual.nombre} → ${productoParaUsar.nombre}. ${notasCorreccion}`,
          clienteId: selectedApartado.clienteId,
          clienteNombre: selectedApartado.clienteNombre,
          detalleCorreccion: {
            productoAnterior: {
              nombre: itemActual.nombre,
              cantidad: cantidadAnterior,
              precio: itemActual.precio || 0,
              subtotal: itemActual.subtotal || 0
            },
            productoNuevo: {
              nombre: productoParaUsar.nombre,
              cantidad: cantidadNueva,
              precio: precioNuevo,
              subtotal: subtotalNuevo
            },
            totalAnterior: totalAnterior,
            totalNuevo: nuevoTotal,
            totalAbonado: totalAbonado,
            diferenciaExceso: diferenciaExceso
          },
          fecha: serverTimestamp(), // Fecha actual - cuando realmente sale el dinero de caja
          userId: currentUser.email || 'Admin'
        });
      }

      await batch.commit();

      let mensaje = '✅ Apartado corregido exitosamente.\n\nInventario actualizado correctamente.';

      // Mostrar advertencia si hubo exceso de pago
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;
        mensaje += `\n\n⚠️ ADVERTENCIA: El total abonado ($${totalAbonado.toLocaleString()}) excede el nuevo total ($${nuevoTotal.toLocaleString()})`;
        mensaje += `\n\n💰 Se creó un egreso automático de $${diferenciaExceso.toLocaleString()} en caja`;
        mensaje += `\n\nDebes devolver este dinero al cliente.`;
      }
      alert(mensaje);

      // Recargar apartado
      const apartadoSnap = await getDoc(apartadoRef);
      setSelectedApartado({ id: apartadoSnap.id, ...apartadoSnap.data() });
      fetchApartados();
      fetchProductos();
      handleCloseCorreccionProducto();

    } catch (error) {
      console.error('Error al corregir apartado:', error);
      alert('❌ Error al corregir apartado: ' + error.message);
    } finally {
      setCorrigiendoProducto(false);
    }
  };

  // Funciones para anulación de productos en apartados
  const handleOpenAnularProducto = (itemIndex) => {
    setItemIndexToAnular(itemIndex);
    setShowAnularProductoModal(true);
    setMotivoAnulacion('');
  };

  const handleCloseAnularProducto = () => {
    setShowAnularProductoModal(false);
    setItemIndexToAnular(null);
    setMotivoAnulacion('');
  };

  const handleAnularProducto = async () => {
    if (!selectedApartado || itemIndexToAnular === null) {
      return;
    }

    if (!motivoAnulacion.trim()) {
      alert('Por favor, ingresa el motivo de la anulación.');
      return;
    }

    const itemToAnular = selectedApartado.items[itemIndexToAnular];

    // Validar que no sea el último producto activo
    const productosActivos = selectedApartado.items.filter(item => !item.anulado);
    if (productosActivos.length === 1 && !itemToAnular.anulado) {
      alert('⚠️ No puedes anular el último producto activo.\n\nSi deseas cancelar todo el apartado, usa la opción "Eliminar Apartado".');
      return;
    }

    const confirmar = window.confirm(
      `⚠️ ANULAR PRODUCTO\n\n` +
      `Apartado #${selectedApartado.numeroApartado}\n` +
      `Producto: ${itemToAnular.nombre}\n` +
      `Talla: ${itemToAnular.talla}\n` +
      `Cantidad: ${itemToAnular.cantidad}\n` +
      `Subtotal: $${itemToAnular.subtotal?.toLocaleString()}\n\n` +
      `Esta acción:\n` +
      `• Liberará ${itemToAnular.cantidad} unidad(es) del inventario reservado\n` +
      `• Reducirá el total del apartado\n` +
      `• Ajustará el saldo pendiente\n` +
      `• El producto quedará marcado como ANULADO (visible para auditoría)\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    setAnulandoProducto(true);
    try {
      const batch = writeBatch(db);
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);

      // Marcar producto como anulado
      const updatedItems = [...selectedApartado.items];
      updatedItems[itemIndexToAnular] = {
        productoId: itemToAnular.productoId || '',
        nombre: itemToAnular.nombre || '',
        referencia: itemToAnular.referencia || '',
        talla: itemToAnular.talla || '',
        precio: itemToAnular.precio || 0,
        cantidad: itemToAnular.cantidad || 0,
        subtotal: itemToAnular.subtotal || 0,
        anulado: true,
        anulacion: {
          fecha: new Date().toISOString(), // No se puede usar serverTimestamp() dentro de arrays
          motivo: motivoAnulacion || '',
          usuario: currentUser.email || 'Admin'
        }
      };

      // Recalcular totales (solo productos NO anulados)
      const nuevoTotal = updatedItems
        .filter(item => !item.anulado)
        .reduce((sum, item) => sum + item.subtotal, 0);

      const nuevoSaldoPendiente = nuevoTotal - (selectedApartado.totalAbonado || 0);

      // Liberar stock reservado
      const productoRef = doc(db, 'products', itemToAnular.productoId);
      batch.update(productoRef, {
        stockReservadoApartados: increment(-itemToAnular.cantidad),
        updatedAt: serverTimestamp()
      });

      // Actualizar apartado
      batch.update(apartadoRef, {
        items: updatedItems,
        totalApartado: nuevoTotal,
        saldoPendiente: nuevoSaldoPendiente,
        updatedAt: serverTimestamp()
      });

      // Verificar si necesitamos crear transacción de egreso
      const totalAbonado = selectedApartado.totalAbonado || 0;

      // Solo crear transacción si nuevo total < total abonado (hay exceso de pago)
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;

        // Crear transacción de egreso/devolución con la fecha ACTUAL (cuando sale el dinero de caja)
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'egreso',
          monto: diferenciaExceso,
          metodoPago: 'Ajuste',
          apartadoId: selectedApartado.id,
          numeroApartado: selectedApartado.numeroApartado,
          descripcion: `Egreso por anulación Apartado #${selectedApartado.numeroApartado}: Total abonado ($${totalAbonado.toLocaleString()}) excede nuevo total ($${nuevoTotal.toLocaleString()})`,
          motivo: motivoAnulacion,
          clienteId: selectedApartado.clienteId,
          clienteNombre: selectedApartado.clienteNombre,
          productoAnulado: {
            nombre: itemToAnular.nombre,
            cantidad: itemToAnular.cantidad,
            precio: itemToAnular.precio || 0,
            subtotal: itemToAnular.subtotal || 0,
            totalAnterior: selectedApartado.totalApartado,
            nuevoTotal: nuevoTotal,
            totalAbonado: totalAbonado,
            diferenciaExceso: diferenciaExceso
          },
          fecha: serverTimestamp(), // Fecha actual - cuando realmente sale el dinero de caja
          userId: currentUser.email || 'Admin'
        });
      }

      await batch.commit();

      let mensaje = `✅ Producto anulado exitosamente.\n\nNuevo total: $${nuevoTotal.toLocaleString()}\nSaldo pendiente: $${nuevoSaldoPendiente.toLocaleString()}`;

      // Mostrar advertencia si hubo exceso de pago
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;
        mensaje += `\n\n⚠️ ADVERTENCIA: El total abonado ($${totalAbonado.toLocaleString()}) excede el nuevo total ($${nuevoTotal.toLocaleString()})`;
        mensaje += `\n\n💰 Se creó un egreso automático de $${diferenciaExceso.toLocaleString()} en caja`;
        mensaje += `\n\nDebes devolver este dinero al cliente.`;
      }
      alert(mensaje);

      // Recargar apartado
      const apartadoSnap = await getDoc(apartadoRef);
      setSelectedApartado({ id: apartadoSnap.id, ...apartadoSnap.data() });
      fetchApartados();
      fetchProductos();
      handleCloseAnularProducto();

    } catch (error) {
      console.error('Error al anular producto:', error);
      alert('❌ Error al anular producto: ' + error.message);
    } finally {
      setAnulandoProducto(false);
    }
  };

  const handleRestaurarProducto = async (itemIndex) => {
    if (!selectedApartado) return;

    const itemToRestaurar = selectedApartado.items[itemIndex];

    const confirmar = window.confirm(
      `🔄 RESTAURAR PRODUCTO\n\n` +
      `Producto: ${itemToRestaurar.nombre}\n` +
      `Cantidad: ${itemToRestaurar.cantidad}\n` +
      `Subtotal: $${itemToRestaurar.subtotal?.toLocaleString()}\n\n` +
      `Esta acción:\n` +
      `• Volverá a reservar ${itemToRestaurar.cantidad} unidad(es) en el inventario\n` +
      `• Aumentará el total del apartado\n` +
      `• Ajustará el saldo pendiente\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    try {
      const batch = writeBatch(db);
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);

      // Quitar marca de anulado
      const updatedItems = [...selectedApartado.items];
      const { anulado, anulacion, ...itemSinAnulacion } = itemToRestaurar;
      updatedItems[itemIndex] = itemSinAnulacion;

      // Recalcular totales
      const nuevoTotal = updatedItems
        .filter(item => !item.anulado)
        .reduce((sum, item) => sum + item.subtotal, 0);

      const nuevoSaldoPendiente = nuevoTotal - (selectedApartado.totalAbonado || 0);

      // Reservar stock nuevamente
      const productoRef = doc(db, 'products', itemToRestaurar.productoId);
      batch.update(productoRef, {
        stockReservadoApartados: increment(itemToRestaurar.cantidad),
        updatedAt: serverTimestamp()
      });

      // Actualizar apartado
      batch.update(apartadoRef, {
        items: updatedItems,
        totalApartado: nuevoTotal,
        saldoPendiente: nuevoSaldoPendiente,
        updatedAt: serverTimestamp()
      });

      // Crear transacción de ajuste POSITIVA SI el apartado tiene abonos
      const totalAbonado = selectedApartado.totalAbonado || 0;
      const tieneAbonos = totalAbonado > 0;

      if (tieneAbonos) {
        const diferenciaTotal = itemToRestaurar.subtotal;
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'restauracion_apartado',
          monto: diferenciaTotal, // POSITIVO - representa reversión de anulación
          metodoPago: 'Ajuste',
          apartadoId: selectedApartado.id,
          numeroApartado: selectedApartado.numeroApartado,
          descripcion: `Restauración producto en Apartado #${selectedApartado.numeroApartado}: ${itemToRestaurar.nombre}`,
          clienteId: selectedApartado.clienteId,
          clienteNombre: selectedApartado.clienteNombre,
          productoRestaurado: {
            nombre: itemToRestaurar.nombre,
            cantidad: itemToRestaurar.cantidad,
            precio: itemToRestaurar.precio,
            subtotal: itemToRestaurar.subtotal
          },
          fecha: serverTimestamp(),
          userId: currentUser.email || 'Admin'
        });
      }

      await batch.commit();

      let mensaje = `✅ Producto restaurado exitosamente.\n\nNuevo total: $${nuevoTotal.toLocaleString()}`;
      if (tieneAbonos) {
        mensaje += `\n\n📊 Transacción de ajuste creada (apartado tiene abonos).`;
      }
      alert(mensaje);

      // Recargar apartado
      const apartadoSnap = await getDoc(apartadoRef);
      setSelectedApartado({ id: apartadoSnap.id, ...apartadoSnap.data() });
      fetchApartados();
      fetchProductos();

    } catch (error) {
      console.error('Error al restaurar producto:', error);
      alert('❌ Error al restaurar producto: ' + error.message);
    }
  };

  // Función para abrir el modal de cambio de método de pago de abono
  const handleOpenCambiarMetodoPagoAbono = (abonoIndex) => {
    const abono = selectedApartado.historialAbonos[abonoIndex];
    setAbonoIndexToEdit(abonoIndex);
    setNuevoMetodoPagoAbono(abono.metodoPago || 'Efectivo');
    setNotasMetodoPagoAbono('');
    setShowCambiarMetodoPagoAbonoModal(true);
  };

  // Función para cerrar el modal de cambio de método de pago de abono
  const handleCloseCambiarMetodoPagoAbono = () => {
    setShowCambiarMetodoPagoAbonoModal(false);
    setAbonoIndexToEdit(null);
    setNuevoMetodoPagoAbono('');
    setNotasMetodoPagoAbono('');
  };

  // Función para cambiar el método de pago de un abono
  const handleCambiarMetodoPagoAbono = async () => {
    if (!selectedApartado || abonoIndexToEdit === null) return;

    if (!notasMetodoPagoAbono.trim()) {
      alert('Por favor, ingresa una nota explicando el cambio.');
      return;
    }

    const abonoActual = selectedApartado.historialAbonos[abonoIndexToEdit];

    if (nuevoMetodoPagoAbono === (abonoActual.metodoPago || 'Efectivo')) {
      alert('El método de pago es el mismo que el actual.');
      return;
    }

    const fechaAbono = abonoActual.fecha?.toDate?.() || new Date(abonoActual.fecha);

    const confirmar = window.confirm(
      `⚠️ CAMBIAR MÉTODO DE PAGO DE ABONO\n\n` +
      `Apartado #${selectedApartado.numeroApartado}\n` +
      `Abono: $${abonoActual.monto.toLocaleString('es-CO')}\n` +
      `Fecha: ${fechaAbono.toLocaleDateString('es-CO')}\n\n` +
      `Método actual: ${abonoActual.metodoPago || 'Efectivo'}\n` +
      `Nuevo método: ${nuevoMetodoPagoAbono}\n\n` +
      `Esta acción:\n` +
      `• Modificará el método de pago del abono\n` +
      `• Actualizará la transacción asociada\n` +
      `• Registrará el cambio para auditoría\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    setCambiandoMetodoPagoAbono(true);
    try {
      const batch = writeBatch(db);
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);

      // 1. Actualizar el abono en el apartado
      const historialActualizado = [...selectedApartado.historialAbonos];
      historialActualizado[abonoIndexToEdit] = {
        ...abonoActual,
        metodoPago: nuevoMetodoPagoAbono,
        correccionMetodoPago: {
          fecha: new Date().toISOString(),
          metodoPagoAnterior: abonoActual.metodoPago || 'Efectivo',
          metodoPagoNuevo: nuevoMetodoPagoAbono,
          notas: notasMetodoPagoAbono,
          usuario: currentUser?.email || 'Admin'
        }
      };

      batch.update(apartadoRef, {
        historialAbonos: historialActualizado,
        updatedAt: serverTimestamp()
      });

      // 2. Buscar y actualizar la transacción asociada
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('apartadoId', '==', selectedApartado.id),
        where('tipo', '==', 'abono_apartado'),
        where('monto', '==', abonoActual.monto)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);

      // Filtrar por fecha para encontrar la transacción exacta
      transactionsSnapshot.docs.forEach(transactionDoc => {
        const transData = transactionDoc.data();
        const transFecha = transData.fecha?.toDate?.();

        // Comparar si es la misma fecha (con margen de 1 minuto)
        if (transFecha && Math.abs(transFecha - fechaAbono) < 60000) {
          batch.update(transactionDoc.ref, {
            metodoPago: nuevoMetodoPagoAbono,
            correccionMetodoPago: {
              fecha: serverTimestamp(),
              metodoPagoAnterior: abonoActual.metodoPago || 'Efectivo',
              metodoPagoNuevo: nuevoMetodoPagoAbono,
              notas: notasMetodoPagoAbono,
              usuario: currentUser?.email || 'Admin'
            }
          });
        }
      });

      await batch.commit();

      alert(
        `✅ Método de pago actualizado\n\n` +
        `Anterior: ${abonoActual.metodoPago || 'Efectivo'}\n` +
        `Nuevo: ${nuevoMetodoPagoAbono}`
      );

      // Recargar el apartado
      const apartadoSnap = await getDoc(apartadoRef);
      setSelectedApartado({ id: apartadoSnap.id, ...apartadoSnap.data() });
      fetchApartados();

      handleCloseCambiarMetodoPagoAbono();

    } catch (error) {
      console.error('Error al cambiar método de pago del abono:', error);
      alert('❌ Error al cambiar método de pago: ' + error.message);
    } finally {
      setCambiandoMetodoPagoAbono(false);
    }
  };

  // Abrir modal de facturación
  const handleFacturarApartado = () => {
    if (!selectedApartado) return;

    const saldoPendiente = selectedApartado.saldoPendiente || 0;
    setMontoPagoFactura(saldoPendiente);
    setMetodoPagoFactura('Efectivo');
    setShowMetodoPagoModal(true);
  };

  // Procesar facturación del apartado
  const procesarFacturacionApartado = async () => {
    if (!selectedApartado) return;

    // Validar estado del apartado
    if (selectedApartado.estadoGeneral === 'Completado') {
      alert('⚠️ Este apartado ya está completado y facturado.');
      return;
    }

    if (selectedApartado.estadoGeneral === 'Cancelado') {
      alert('⚠️ Este apartado está cancelado. No se puede facturar.');
      return;
    }

    const saldoPendiente = selectedApartado.saldoPendiente || 0;
    const montoPagadoHoy = parseFloat(montoPagoFactura) || 0;

    if (montoPagadoHoy < saldoPendiente) {
      alert(`El monto debe ser al menos $${saldoPendiente.toLocaleString()} (el saldo pendiente)`);
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmar facturación?\n\n` +
      `Monto a pagar ahora: $${montoPagadoHoy.toLocaleString()}\n` +
      `Método: ${metodoPagoFactura}\n\n` +
      `Se generará una factura y el apartado quedará completado.`
    );

    if (!confirmar) return;

    try {
      // Cerrar el modal
      setShowMetodoPagoModal(false);

      // Paso 2: Obtener siguiente número de factura
      const salesSnapshot = await getDocs(query(collection(db, 'sales'), orderBy('numeroFactura', 'desc')));
      let siguienteNumero = 1;
      if (!salesSnapshot.empty) {
        const ultimaFactura = salesSnapshot.docs[0].data();
        siguienteNumero = (ultimaFactura.numeroFactura || 0) + 1;
      }

      // Paso 3: Preparar datos de la venta
      const ventaData = {
        numeroFactura: siguienteNumero,
        clienteId: selectedApartado.clienteId,
        clienteNombre: selectedApartado.clienteNombre,
        clienteTelefono: selectedApartado.clienteTelefono || '',
        clienteDocumento: selectedApartado.clienteDocumento || '',
        items: selectedApartado.items,
        subtotal: selectedApartado.totalApartado,
        totalVenta: selectedApartado.totalApartado,
        metodoPago: metodoPagoFactura,
        montoPagado: montoPagadoHoy,
        cambio: montoPagadoHoy - saldoPendiente,
        apartadoId: selectedApartado.id,
        esFacturaDeApartado: true,
        totalAbonoPrevio: selectedApartado.totalAbonado,
        pagoFinal: montoPagadoHoy,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      };

      // Paso 4: Ejecutar batch
      const batch = writeBatch(db);

      // Crear venta
      const ventaRef = doc(collection(db, 'sales'));
      batch.set(ventaRef, ventaData);

      // Actualizar apartado a Completado
      const apartadoRef = doc(db, 'apartados', selectedApartado.id);
      batch.update(apartadoRef, {
        estadoGeneral: 'Completado',
        saldoPendiente: 0,
        totalAbonado: selectedApartado.totalApartado,
        fechaCompletado: serverTimestamp(),
        facturaId: ventaRef.id,
        numeroFactura: siguienteNumero,
        updatedAt: serverTimestamp()
      });

      // Actualizar inventario: restar del total y liberar reserva
      // IMPORTANTE: Solo procesar productos NO anulados y que aún existan
      const productosNoEncontrados = [];
      for (const item of selectedApartado.items) {
        if (item.anulado) continue; // Saltar productos anulados (ya liberaron su reserva)

        const productoRef = doc(db, 'products', item.productoId);

        // Verificar si el producto existe antes de actualizarlo
        const productoSnap = await getDoc(productoRef);
        if (!productoSnap.exists()) {
          productosNoEncontrados.push(item.nombre || item.productoId);
          continue; // Saltar productos que ya no existen
        }

        batch.update(productoRef, {
          stockTotal: increment(-item.cantidad),
          stockReservadoApartados: increment(-item.cantidad)
        });
      }

      // Advertir sobre productos no encontrados (pero continuar con la facturación)
      if (productosNoEncontrados.length > 0) {
        console.warn('Productos no encontrados en inventario:', productosNoEncontrados);
      }

      // 5. (NUEVO) Registrar Transacción del Pago Final
      if (montoPagadoHoy > 0) {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'abono_apartado', // Se registra como abono
          monto: montoPagadoHoy,
          metodoPago: metodoPagoFactura,
          apartadoId: selectedApartado.id,
          ventaId: ventaRef.id, // Referencia a la factura que genera
          descripcion: `Pago final Apartado -> Factura #${siguienteNumero}`,
          clienteId: selectedApartado.clienteId,
          clienteNombre: selectedApartado.clienteNombre,
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });
      }

      await batch.commit();

      // Paso 5: Preparar datos para tirilla de factura
      setFacturaData({
        ...ventaData,
        id: ventaRef.id,
        fecha: new Date()
      });

      alert('¡Apartado facturado exitosamente!');
      setShowManageModal(false);
      setShowFacturaModal(true);
      fetchApartados();
      fetchProductos();

    } catch (error) {
      console.error('Error al facturar apartado:', error);
      alert('Error al facturar apartado: ' + error.message);
    }
  };

  // Imprimir tirilla
  const handlePrint = () => {
    window.print();
  };

  // Imprimir recibo de abono
  const handlePrintAbono = () => {
    const receiptElement = document.getElementById('abono-receipt-print');
    if (!receiptElement) {
      alert('No se pudo encontrar el contenido del recibo');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=700');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Recibo de Abono</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            background: #f0f0f0;
          }
          #receipt-container {
            width: 80mm;
            max-width: 80mm;
            background: white;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="receipt-container">${receiptElement.innerHTML}</div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  };

  // ====== SEND EMAIL ======
  const handleOpenEmailModal = () => {
    // Pre-fill with client's email if available
    const clientEmail = clientes.find(c => c.id === selectedApartado?.clienteId)?.email || '';
    setEmailRecipient(clientEmail);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailRecipient.trim()) {
      alert('Por favor ingrese un correo electrónico');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRecipient)) {
      alert('Por favor ingrese un correo electrónico válido');
      return;
    }

    setSendingEmail(true);
    try {
      const sendApartadoEmail = httpsCallable(functions, 'sendApartadoEmail');
      const result = await sendApartadoEmail({
        apartadoId: selectedApartado.id,
        toEmail: emailRecipient.trim()
      });

      // Actualizar el email del cliente en la base de datos si se ingresó manualmente
      if (selectedApartado?.clienteId) {
        try {
          const clienteActual = clientes.find(c => c.id === selectedApartado.clienteId);
          // Solo actualizar si el email es diferente o no existe
          if (clienteActual && clienteActual.email !== emailRecipient.trim()) {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'clients', selectedApartado.clienteId), {
              email: emailRecipient.trim()
            });

            // Actualizar el cliente en el estado local
            setClientes(prevClientes =>
              prevClientes.map(c =>
                c.id === selectedApartado.clienteId
                  ? { ...c, email: emailRecipient.trim() }
                  : c
              )
            );
          }
        } catch (error) {
          console.error('Error al actualizar email del cliente:', error);
          // No mostramos error al usuario, el correo sí se envió
        }
      }

      alert('✅ Correo enviado exitosamente a ' + emailRecipient);
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error al enviar correo:', error);
      alert('❌ Error al enviar el correo: ' + (error.message || 'Error desconocido'));
    } finally {
      setSendingEmail(false);
    }
  };

  // Filtrar apartados con ordenamiento por relevancia
  const apartadosFiltrados = apartados
    .filter(apartado => {
      const searchLower = searchTerm.toLowerCase();
      const matchNumero = String(apartado.numeroApartado || '').includes(searchTerm);
      const matchNombre = apartado.clienteNombre?.toLowerCase().includes(searchLower);
      const matchTelefono = apartado.clienteTelefono?.includes(searchTerm);
      const matchDocumento = apartado.clienteDocumento?.includes(searchTerm);

      const matchSearch = matchNumero || matchNombre || matchTelefono || matchDocumento;
      const matchEstado = filtroEstado === 'Todos' || apartado.estadoGeneral === filtroEstado;

      return matchSearch && matchEstado;
    })
    .sort((a, b) => {
      // Si hay búsqueda activa, ordenar por relevancia
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        const aNumero = String(a.numeroApartado || '');
        const bNumero = String(b.numeroApartado || '');

        // Prioridad 1: Coincidencia exacta en número de apartado
        const aExactMatch = aNumero === searchTerm;
        const bExactMatch = bNumero === searchTerm;
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;

        // Prioridad 2: Comienza con el término de búsqueda en número de apartado
        const aStartsWith = aNumero.startsWith(searchTerm);
        const bStartsWith = bNumero.startsWith(searchTerm);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Prioridad 3: Contiene el término en número de apartado
        const aContainsNumero = aNumero.includes(searchTerm);
        const bContainsNumero = bNumero.includes(searchTerm);
        if (aContainsNumero && !bContainsNumero) return -1;
        if (!aContainsNumero && bContainsNumero) return 1;

        // Prioridad 4: Coincidencia exacta en nombre del cliente
        const aNombreExact = (a.clienteNombre || '').toLowerCase() === searchLower;
        const bNombreExact = (b.clienteNombre || '').toLowerCase() === searchLower;
        if (aNombreExact && !bNombreExact) return -1;
        if (!aNombreExact && bNombreExact) return 1;

        // Prioridad 5: Comienza con el término en nombre del cliente
        const aNombreStarts = (a.clienteNombre || '').toLowerCase().startsWith(searchLower);
        const bNombreStarts = (b.clienteNombre || '').toLowerCase().startsWith(searchLower);
        if (aNombreStarts && !bNombreStarts) return -1;
        if (!aNombreStarts && bNombreStarts) return 1;
      }

      // Orden por defecto: apartados más recientes primero
      return (b.numeroApartado || 0) - (a.numeroApartado || 0);
    });

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const apartadosActuales = apartadosFiltrados.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(apartadosFiltrados.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {authError && !loading && (
        <div className="max-w-7xl mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertTriangle className="mx-auto mb-3" size={48} style={{ color: '#dc2626' }} />
            <h3 className="text-xl font-bold text-red-800 mb-2">Error de autenticación</h3>
            <p className="text-red-600">{authError}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-4 px-6 py-2 text-white rounded-lg hover:opacity-90"
              style={{ backgroundColor: '#D50565' }}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !authError && (
        <>
          {/* Header */}
          <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Apartados</h1>
            <p className="text-gray-600 mt-1">Gestiona los apartados de tus clientes</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white rounded-xl hover:opacity-90 transition-all flex items-center gap-2 font-medium shadow-md"
            style={{ backgroundColor: '#D50565' }}
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Nuevo Apartado</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por número de apartado, cliente, teléfono o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Filtro de estado */}
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Activo">Activos</option>
              <option value="Completado">Completados</option>
              <option value="Vencido">Vencidos</option>
              <option value="Cancelado">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de apartados */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          {/* Vista de Tarjetas - Solo Móvil */}
          <div className="md:hidden space-y-4 p-4">
            {apartadosActuales.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No se encontraron apartados
              </div>
            ) : (
              apartadosActuales.map((apartado) => {
                const diasRestantes = calcularDiasRestantes(apartado.fechaLimite);
                return (
                  <div key={apartado.id} className="bg-white border rounded-lg p-4 shadow-sm">
                    {/* Header de la tarjeta */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        {apartado.numeroApartado && (
                          <p className="text-xs font-semibold text-gray-500 mb-1">
                            Apartado #{apartado.numeroApartado}
                          </p>
                        )}
                        <p className="font-semibold text-gray-900">{apartado.clienteNombre}</p>
                        {apartado.colegioNombre && (
                          <p className="text-sm text-gray-600 mt-0.5">{apartado.colegioNombre}</p>
                        )}
                        {apartado.clienteTelefono && (
                          <a
                            href={`tel:${apartado.clienteTelefono}`}
                            className="text-sm hover:underline flex items-center gap-1 mt-1"
                            style={{ color: '#D50565' }}
                          >
                            <Phone size={12} />
                            {apartado.clienteTelefono}
                          </a>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadgeColor(apartado.estadoGeneral)}`}>
                        {apartado.estadoGeneral}
                      </span>
                    </div>

                    {/* Información del apartado */}
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Productos:</span>
                        <p className="font-medium text-gray-900">
                          {apartado.items?.length || 0} producto{apartado.items?.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <p className="font-bold text-gray-900">${apartado.totalApartado?.toLocaleString() || 0}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Abonado:</span>
                        <p className="font-medium text-green-600">${apartado.totalAbonado?.toLocaleString() || 0}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Saldo:</span>
                        <p className="font-bold text-red-600">${apartado.saldoPendiente?.toLocaleString() || 0}</p>
                      </div>
                    </div>

                    {/* Días restantes */}
                    {diasRestantes !== null && (
                      <div className={`text-sm mb-3 p-2 rounded ${getColorDiasRestantes(diasRestantes)}`}>
                        {diasRestantes < 0 ? (
                          <span className="flex items-center gap-1 justify-center">
                            <AlertTriangle size={16} />
                            Vencido hace {Math.abs(diasRestantes)} días
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 justify-center">
                            <Clock size={16} />
                            {diasRestantes} día{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedApartado(apartado);
                          setShowManageModal(true);
                        }}
                        className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#D50565' }}
                      >
                        <Eye size={16} />
                        Ver Detalles
                      </button>
                      <button
                        onClick={() => {
                          setSelectedApartado(apartado);
                          setShowReceiptModal(true);
                        }}
                        className="px-4 py-2 rounded-lg hover:opacity-90 transition-opacity border-2 text-sm font-medium flex items-center justify-center"
                        style={{ borderColor: '#EA5C2E', color: '#EA5C2E' }}
                      >
                        <Printer size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Vista de Tabla - Solo Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Productos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total / Abonado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Saldo Pendiente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Días Restantes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {apartadosActuales.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      No se encontraron apartados
                    </td>
                  </tr>
                ) : (
                  apartadosActuales.map((apartado) => {
                    const diasRestantes = calcularDiasRestantes(apartado.fechaLimite);
                    return (
                      <tr key={apartado.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-600">
                            {apartado.numeroApartado ? `#${apartado.numeroApartado}` : '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-800">{apartado.clienteNombre}</p>
                            {apartado.colegioNombre && (
                              <p className="text-sm text-gray-600">{apartado.colegioNombre}</p>
                            )}
                            {apartado.clienteTelefono && (
                              <a
                                href={`tel:${apartado.clienteTelefono}`}
                                className="text-sm hover:underline flex items-center gap-1"
                                style={{ color: '#D50565' }}
                              >
                                <Phone size={12} />
                                {apartado.clienteTelefono}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700">
                            {apartado.items?.length || 0} producto{apartado.items?.length !== 1 ? 's' : ''}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-semibold text-gray-800">
                              ${apartado.totalApartado?.toLocaleString() || 0}
                            </p>
                            <p className="text-green-600">
                              ${apartado.totalAbonado?.toLocaleString() || 0}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-red-600">
                            ${apartado.saldoPendiente?.toLocaleString() || 0}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {diasRestantes !== null ? (
                            <div className={getColorDiasRestantes(diasRestantes)}>
                              {diasRestantes < 0 ? (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle size={16} />
                                  Vencido hace {Math.abs(diasRestantes)} días
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock size={16} />
                                  {diasRestantes} día{diasRestantes !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getEstadoBadgeColor(apartado.estadoGeneral)}`}>
                            {apartado.estadoGeneral}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedApartado(apartado);
                                setShowManageModal(true);
                              }}
                              className="p-2 hover:bg-pink-50 rounded-lg transition-colors"
                              style={{ color: '#D50565' }}
                              title="Ver detalles"
                            >
                              <Eye size={20} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedApartado(apartado);
                                setShowReceiptModal(true);
                              }}
                              className="p-2 hover:bg-orange-50 rounded-lg transition-colors"
                              style={{ color: '#EA5C2E' }}
                              title="Imprimir tirilla"
                            >
                              <Printer size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                <span className="hidden sm:inline">
                  Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, apartadosFiltrados.length)} de {apartadosFiltrados.length}
                </span>
                <span className="sm:hidden">
                  {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, apartadosFiltrados.length)} de {apartadosFiltrados.length}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">Anterior</span>
                  <span className="sm:hidden">&larr;</span>
                </button>
                <span className="sm:hidden flex items-center px-3 text-sm font-medium text-gray-700">
                  Pág. {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <span className="sm:hidden">&rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Crear Apartado */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10 rounded-t-xl">
              <h2 className="text-2xl font-bold text-gray-800">Nuevo Apartado</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Selección de cliente */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Cliente *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowClientModal(true)}
                    style={{ backgroundColor: '#D50565' }}
                    className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                  >
                    + Crear Cliente
                  </button>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre, teléfono o documento..."
                    value={searchCliente}
                    onChange={(e) => setSearchCliente(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                {searchCliente && (
                  <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto mt-2">
                    {clientesFiltrados.length === 0 ? (
                      <p className="p-4 text-center text-gray-500">No se encontraron clientes</p>
                    ) : (
                      clientesFiltrados.map(cliente => {
                        const nombreCliente = cliente.nombreCompleto || cliente.nombre || 'Sin nombre';
                        const documentoCliente = cliente.numeroDocumento || cliente.documento;
                        return (
                          <div
                            key={cliente.id}
                            onClick={() => {
                              setSelectedClienteId(cliente.id);
                              setSearchCliente(nombreCliente);
                            }}
                            className={`p-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-pink-50 transition-colors ${
                              selectedClienteId === cliente.id ? 'bg-pink-100' : ''
                            }`}
                          >
                            <p className="font-medium text-gray-800">{nombreCliente}</p>
                            <p className="text-sm text-gray-600">
                              {cliente.telefono && `Tel: ${cliente.telefono}`}
                              {cliente.telefono && documentoCliente && ' | '}
                              {documentoCliente && `Doc: ${documentoCliente}`}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Selección de colegio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colegio (Opcional)
                </label>
                <select
                  value={selectedColegioId}
                  onChange={(e) => setSelectedColegioId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">Sin colegio</option>
                  {colegios.map(colegio => (
                    <option key={colegio.id} value={colegio.id}>
                      {colegio.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plazo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plazo (días)
                </label>
                <select
                  value={plazoSeleccionado}
                  onChange={(e) => setPlazoSeleccionado(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value={5}>5 días</option>
                  <option value={15}>15 días</option>
                  <option value={30}>30 días</option>
                  <option value={45}>45 días</option>
                  <option value={60}>60 días</option>
                </select>
              </div>

              {/* Selección de productos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agregar Productos
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre o referencia..."
                    value={searchProducto}
                    onChange={(e) => setSearchProducto(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                {searchProducto && (
                  <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto mt-2">
                    {productosFiltrados.length === 0 ? (
                      <p className="text-center text-gray-500">No se encontraron productos con stock disponible</p>
                    ) : (
                      productosFiltrados.map(producto => {
                        const disponible = (producto.stockTotal || 0) - (producto.stockReservadoPedidos || 0) - (producto.stockReservadoApartados || 0) - (producto.stockReservadoB2B || 0);
                        const stockDisponible = Math.max(0, disponible); // Nunca muestra negativos
                        const tallaKey = `${producto.id}`;
                        return (
                          <div key={producto.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{producto.nombre}</p>
                              <p className="text-sm text-gray-600">
                                Ref: {producto.referencia} | Disponible: {stockDisponible}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {producto.tallas && producto.tallas.length > 0 && (
                                <select
                                  value={tallasSeleccionadas[tallaKey] || producto.tallas[0]}
                                  onChange={(e) => handleTallaChange(tallaKey, e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                >
                                  {producto.tallas.map(talla => (
                                    <option key={talla} value={talla}>{talla}</option>
                                  ))}
                                </select>
                              )}
                              <button
                                onClick={() => agregarProducto(producto)}
                                className="px-3 py-1 text-white rounded hover:opacity-90 text-sm transition-all"
                                style={{ backgroundColor: '#EA5C2E' }}
                              >
                                Agregar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Productos seleccionados */}
              {selectedProductos.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Productos Seleccionados ({selectedProductos.length})
                  </label>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Producto</th>
                          <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Talla</th>
                          <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Cantidad</th>
                          <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Precio Unit.</th>
                          <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Subtotal</th>
                          <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedProductos.map((producto, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-800">{producto.nombre}</td>
                            <td className="px-4 py-2 text-center text-sm text-gray-600">{producto.tallaSeleccionada}</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min="1"
                                max={producto.stockDisponible}
                                value={producto.cantidad}
                                onChange={(e) => actualizarCantidadProducto(index, e.target.value)}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                              />
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-800">
                              ${producto.precioUnitario.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-semibold text-gray-800">
                              ${(producto.cantidad * producto.precioUnitario).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => eliminarProducto(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Total y abono inicial */}
              {selectedProductos.length > 0 && (
                <div className="rounded-lg p-4 space-y-4" style={{ backgroundColor: '#FFF1E5' }}>
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold text-gray-700">Total del Apartado:</span>
                    <span className="font-bold text-gray-900">
                      ${calcularTotales().subtotal.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Abono Inicial (opcional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={calcularTotales().subtotal}
                      value={abonoInicial}
                      onChange={(e) => setAbonoInicial(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="0"
                    />
                  </div>

                  {parseFloat(abonoInicial) > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Método de Pago
                        </label>
                        <select
                          value={metodoPago}
                          onChange={(e) => setMetodoPago(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="Nequi">Nequi</option>
                          <option value="Daviplata">Daviplata</option>
                          <option value="Nu">Nu</option>
                          <option value="Tarjeta">Tarjeta</option>
                        </select>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Saldo Pendiente:</span>
                        <span className="font-bold text-red-600">
                          ${(calcularTotales().subtotal - parseFloat(abonoInicial)).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={notasApartado}
                  onChange={(e) => setNotasApartado(e.target.value)}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Observaciones del apartado..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearApartado}
                disabled={!selectedClienteId || selectedProductos.length === 0 || creandoApartado}
                className="px-6 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: '#D50565' }}
              >
                {creandoApartado ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear Apartado'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gestionar Apartado - Continuará en el siguiente bloque... */}
      {showManageModal && selectedApartado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10 rounded-t-xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Gestión de Apartado {selectedApartado.numeroApartado && `#${selectedApartado.numeroApartado}`}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Cliente: {selectedApartado.clienteNombre}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedApartado(selectedApartado);
                    setShowReceiptModal(true);
                  }}
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90 font-medium flex items-center gap-2"
                  style={{ backgroundColor: '#EA5C2E' }}
                >
                  <Printer size={18} />
                  Imprimir Tirilla
                </button>
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    setSelectedApartado(null);
                    setNuevoAbono('');
                    setNotasAbono('');
                    setMetodoPagoAbono('Efectivo');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Información general */}
              <div className="rounded-lg p-4" style={{ backgroundColor: '#C5D6EF' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-700">Total Apartado</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${selectedApartado.totalApartado?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">Total Abonado</p>
                    <p className="text-lg font-bold text-green-600">
                      ${selectedApartado.totalAbonado?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">Saldo Pendiente</p>
                    <p className="text-lg font-bold text-red-600">
                      ${selectedApartado.saldoPendiente?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">Estado</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getEstadoBadgeColor(selectedApartado.estadoGeneral)}`}>
                      {selectedApartado.estadoGeneral}
                    </span>
                  </div>
                </div>
              </div>

              {/* Información de plazo */}
              <div className="rounded-lg p-4" style={{ backgroundColor: '#FFF1E5' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Plazo Original</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedApartado.plazoOriginalDias} días
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Días Extendidos</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedApartado.diasExtendidos || 0} días
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Días Restantes</p>
                    <p className={`text-lg font-semibold ${getColorDiasRestantes(calcularDiasRestantes(selectedApartado.fechaLimite))}`}>
                      {(() => {
                        const dias = calcularDiasRestantes(selectedApartado.fechaLimite);
                        if (dias < 0) return `Vencido hace ${Math.abs(dias)} días`;
                        return `${dias} día${dias !== 1 ? 's' : ''}`;
                      })()}
                    </p>
                  </div>
                </div>

                {(selectedApartado.estadoGeneral === 'Activo' || selectedApartado.estadoGeneral === 'Vencido') && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleExtenderPlazo(15)}
                      className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#EA5C2E' }}
                    >
                      <Calendar size={18} />
                      Extender 15 días
                    </button>
                    <button
                      onClick={() => handleExtenderPlazo(30)}
                      className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#D50565' }}
                    >
                      <Calendar size={18} />
                      Extender 30 días
                    </button>
                  </div>
                )}
              </div>

              {/* Productos */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Productos</h3>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Producto</th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Talla</th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Cantidad</th>
                        <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Precio Unit.</th>
                        <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Subtotal</th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedApartado.items?.map((item, index) => (
                        <tr key={index} className={item.anulado ? 'bg-gray-50' : ''}>
                          <td className={`px-4 py-2 text-sm ${item.anulado ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {item.nombre}
                            {item.anulado && (
                              <div className="text-xs text-red-600 mt-1 font-normal">
                                ❌ ANULADO - {item.anulacion?.motivo}
                              </div>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-center text-sm ${item.anulado ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                            {item.talla}
                          </td>
                          <td className={`px-4 py-2 text-center text-sm ${item.anulado ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                            {item.cantidad}
                          </td>
                          <td className={`px-4 py-2 text-right text-sm ${item.anulado ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            ${item.precioUnitario?.toLocaleString()}
                          </td>
                          <td className={`px-4 py-2 text-right text-sm font-semibold ${item.anulado ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {item.anulado ? '[ANULADO]' : `$${item.subtotal?.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {!item.anulado ? (
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => handleOpenCorreccionProducto(index)}
                                  className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
                                  title="Corregir producto o cantidad"
                                >
                                  Corregir
                                </button>
                                <button
                                  onClick={() => handleOpenAnularProducto(index)}
                                  className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                  title="Anular este producto"
                                >
                                  Anular
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRestaurarProducto(index)}
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                title="Restaurar producto anulado"
                              >
                                Restaurar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registrar abono */}
              {selectedApartado.estadoGeneral === 'Activo' && selectedApartado.saldoPendiente > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <DollarSign size={20} style={{ color: '#D50565' }} />
                    Registrar Abono
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monto del Abono
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={selectedApartado.saldoPendiente}
                        value={nuevoAbono}
                        onChange={(e) => setNuevoAbono(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={metodoPagoAbono}
                        onChange={(e) => setMetodoPagoAbono(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      >
                        <option>Efectivo</option>
                        <option>Nequi</option>
                        <option>Daviplata</option>
                        <option>Nu</option>
                        <option>Tarjeta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notas del Abono (opcional)
                      </label>
                      <input
                        type="text"
                        value={notasAbono}
                        onChange={(e) => setNotasAbono(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        placeholder="Observaciones..."
                      />
                    </div>
                    <button
                      onClick={handleRegistrarAbono}
                      disabled={!nuevoAbono || parseFloat(nuevoAbono) <= 0 || registrandoAbono}
                      className="w-full px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#D50565' }}
                    >
                      {registrandoAbono ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CheckCircle size={18} />
                      )}
                      {registrandoAbono ? 'Registrando...' : 'Registrar Abono'}
                    </button>
                  </div>
                </div>
              )}

              {/* Historial de abonos */}
              {selectedApartado.historialAbonos && selectedApartado.historialAbonos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Historial de Abonos</h3>
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Fecha</th>
                          <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Monto</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Método</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Notas</th>
                          {isAdmin && <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Acción</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedApartado.historialAbonos.map((abono, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {abono.fecha?.toDate?.()?.toLocaleDateString('es-CO') || 'Fecha no disponible'}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-semibold text-green-600">
                              ${abono.monto?.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {abono.metodoPago || 'Efectivo'}
                              {abono.correccionMetodoPago && (
                                <span className="ml-1 text-[10px] text-orange-600" title={`Corregido: ${abono.correccionMetodoPago.notas}`}>
                                  ✏️
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {abono.notas || '-'}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => handleOpenCambiarMetodoPagoAbono(index)}
                                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                  title="Cambiar método de pago"
                                >
                                  ✏️ Editar
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notas del apartado */}
              {selectedApartado.notas && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Notas</h3>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3">
                    {selectedApartado.notas}
                  </p>
                </div>
              )}

              {/* Botón cancelar apartado */}
              {(selectedApartado.estadoGeneral === 'Activo' || selectedApartado.estadoGeneral === 'Vencido') && (
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={handleCancelarApartado}
                    disabled={cancelandoApartado}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {cancelandoApartado ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <XCircle size={18} />
                    )}
                    {cancelandoApartado ? 'Cancelando...' : 'Cancelar Apartado'}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    El inventario será liberado y el apartado quedará cancelado
                  </p>
                </div>
              )}

              {/* Botón eliminar apartado permanentemente */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <button
                  onClick={handleEliminarApartado}
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Eliminar Permanentemente
                </button>
                <p className="text-xs text-red-500 text-center mt-2">
                  ⚠️ Elimina el apartado y todas sus transacciones de la base de datos
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
              {(selectedApartado.estadoGeneral === 'Activo' || selectedApartado.estadoGeneral === 'Vencido') && (
                <button
                  onClick={handleFacturarApartado}
                  className="px-6 py-2 text-white rounded-lg hover:opacity-90 font-medium flex items-center gap-2"
                  style={{ backgroundColor: '#EA5C2E' }}
                >
                  <CheckCircle size={18} />
                  Facturar Apartado
                </button>
              )}
              <button
                onClick={() => {
                  setShowManageModal(false);
                  setSelectedApartado(null);
                  setNuevoAbono('');
                  setNotasAbono('');
                  setMetodoPagoAbono('Efectivo');
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Imprimir Tirilla de Apartado - CONTINÚA... */}
      {showReceiptModal && selectedApartado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full flex flex-col" style={{ maxWidth: '400px', maxHeight: '90vh' }}>

            {/* Header - Fijo arriba */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Vista Previa - Tirilla</h2>
                <button
                  onClick={() => {
                    setShowReceiptModal(false);
                    if (!showManageModal) {
                      setSelectedApartado(null);
                    }
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Receipt Preview - Con scroll si es necesario */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex justify-center">
                <div id="receipt-print" className="border p-4 bg-white" style={{ maxWidth: '300px' }}>

              {/* Company Info */}
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg">{companyConfig?.nombre || 'MARTHA ROMERO'}</h3>
                {companyConfig?.nit && <p className="text-xs">NIT: {companyConfig.nit}</p>}
                {companyConfig?.direccion && <p className="text-xs">{companyConfig.direccion}</p>}
                {companyConfig?.telefono && <p className="text-xs">Tel: {companyConfig.telefono}</p>}
                <p className="font-bold text-sm mt-2" style={{ letterSpacing: '1px' }}>APARTADO</p>
                {selectedApartado.numeroApartado && (
                  <p className="font-bold text-sm">#{selectedApartado.numeroApartado}</p>
                )}
              </div>

              {/* Order Info */}
              <div className="border-t border-b border-dashed py-2 mb-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Cliente:</span>
                  <span className="text-right">{selectedApartado.clienteNombre}</span>
                </div>
                {selectedApartado.clienteTelefono && (
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Teléfono:</span>
                    <span>{selectedApartado.clienteTelefono}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Fecha:</span>
                  <span>{selectedApartado.createdAt?.toDate?.()?.toLocaleDateString('es-CO') || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Fecha Límite:</span>
                  <span>{selectedApartado.fechaLimite?.toDate?.()?.toLocaleDateString('es-CO') || 'N/A'}</span>
                </div>
                {(() => {
                  const dias = calcularDiasRestantes(selectedApartado.fechaLimite);
                  return dias !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Días Restantes:</span>
                      <span className={dias < 0 ? 'text-red-600' : (dias <= 5 ? 'text-orange-600' : 'text-green-600')}>
                        {dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : `${dias} día${dias !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Items */}
              <div className="border-b border-dashed py-2 mb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Producto</th>
                      <th className="text-center">Cant</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedApartado.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-1">
                          <div className="font-medium">{item.nombre}</div>
                          <div className="text-gray-600 text-[10px]">
                            {item.talla && `Talla: ${item.talla} | `}
                            ${(item.precioUnitario || 0).toLocaleString('es-CO')}
                          </div>
                        </td>
                        <td className="text-center">{item.cantidad}</td>
                        <td className="text-right">${(item.subtotal || 0).toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-2">
                <div className="flex justify-between">
                  <span>Total Apartado:</span>
                  <span>${(selectedApartado.totalApartado || 0).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Total Abonado:</span>
                  <span>${(selectedApartado.totalAbonado || 0).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>SALDO PENDIENTE:</span>
                  <span className="text-red-600">${(selectedApartado.saldoPendiente || 0).toLocaleString('es-CO')}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center mt-4 text-xs border-t pt-2">
                <p>Estado: {selectedApartado.estadoGeneral}</p>
                {selectedApartado.notas && (
                  <p className="italic">Notas: {selectedApartado.notas}</p>
                )}
                <p>¡Gracias por su preferencia!</p>
              </div>
                </div>
              </div>
            </div>

            {/* Botones - Fijos abajo */}
            <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#EA5C2E' }}
                >
                  <Printer size={18} />
                  Imprimir
                </button>
                <button
                  onClick={handleOpenEmailModal}
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 font-medium flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#D50565' }}
                >
                  📧 Enviar por Correo
                </button>
                <button
                  onClick={() => {
                    setShowReceiptModal(false);
                    if (!showManageModal) {
                      setSelectedApartado(null);
                    }
                  }}
                  className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recibo de Abono */}
      {showAbonoReceiptModal && lastAbono && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full flex flex-col" style={{ maxWidth: '400px', maxHeight: '90vh' }}>

            {/* Header - Fijo arriba */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Recibo de Abono</h2>
                <button
                  onClick={() => {
                    setShowAbonoReceiptModal(false);
                    setLastAbono(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Receipt Preview - Con scroll si es necesario */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex justify-center">
                <div id="abono-receipt-print" style={{
                maxWidth: '300px',
                margin: '0 auto',
                padding: '16px',
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                fontFamily: 'Arial, sans-serif'
              }}>
                {/* Encabezado */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontWeight: 'bold', fontSize: '18px', margin: '10px 0 8px 0' }}>
                    {companyConfig?.nombre || 'MARTHA ROMERO UNIFORMES'}
                  </h3>
                  {companyConfig?.direccion && (
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#666' }}>
                      {companyConfig.direccion}
                    </p>
                  )}
                  {companyConfig?.telefono && (
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#666' }}>
                      Tel: {companyConfig.telefono}
                    </p>
                  )}
                  {companyConfig?.nit && (
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#666' }}>
                      NIT: {companyConfig.nit}
                    </p>
                  )}
                </div>

                <div style={{ borderTop: '2px dashed #000', margin: '12px 0' }}></div>

                {/* Tipo de documento */}
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontWeight: 'bold', fontSize: '16px', margin: '0' }}>
                    RECIBO DE ABONO
                  </h4>
                  {lastAbono.apartado.numeroApartado && (
                    <p style={{ fontSize: '14px', margin: '4px 0', fontWeight: 'bold' }}>
                      Apartado #{lastAbono.apartado.numeroApartado}
                    </p>
                  )}
                </div>

                <div style={{ borderTop: '2px dashed #000', margin: '12px 0' }}></div>

                {/* Información */}
                <div style={{ marginBottom: '12px', fontSize: '12px' }}>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Cliente:</strong> {lastAbono.apartado.clienteNombre}
                  </p>
                  {lastAbono.apartado.clienteTelefono && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>Teléfono:</strong> {lastAbono.apartado.clienteTelefono}
                    </p>
                  )}
                  <p style={{ margin: '4px 0' }}>
                    <strong>Fecha:</strong> {lastAbono.fecha.toLocaleDateString('es-CO')}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Hora:</strong> {lastAbono.fecha.toLocaleTimeString('es-CO')}
                  </p>
                </div>

                <div style={{ borderTop: '2px dashed #000', margin: '12px 0' }}></div>

                {/* Detalles del abono */}
                <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                    <span>Total Apartado:</span>
                    <span>${lastAbono.apartado.totalApartado?.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', color: '#16a34a', fontWeight: 'bold', fontSize: '16px' }}>
                    <span>ABONO RECIBIDO:</span>
                    <span>${lastAbono.monto.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                    <span>Total Abonado:</span>
                    <span>${lastAbono.nuevoTotalAbonado.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', color: '#dc2626', fontWeight: 'bold' }}>
                    <span>SALDO PENDIENTE:</span>
                    <span>${lastAbono.nuevoSaldoPendiente.toLocaleString()}</span>
                  </div>
                </div>

                {lastAbono.notas && (
                  <>
                    <div style={{ borderTop: '2px dashed #000', margin: '12px 0' }}></div>
                    <div style={{ fontSize: '11px', marginBottom: '12px' }}>
                      <p style={{ margin: '4px 0' }}>
                        <strong>Observaciones:</strong>
                      </p>
                      <p style={{ margin: '4px 0', fontStyle: 'italic' }}>
                        {lastAbono.notas}
                      </p>
                    </div>
                  </>
                )}

                <div style={{ borderTop: '2px dashed #000', margin: '12px 0' }}></div>

                {/* Información adicional */}
                <div style={{ fontSize: '10px', textAlign: 'center', color: '#666', marginTop: '12px' }}>
                  {lastAbono.nuevoSaldoPendiente === 0 ? (
                    <p style={{ margin: '8px 0', fontWeight: 'bold', color: '#16a34a', fontSize: '12px' }}>
                      ¡APARTADO COMPLETADO!
                    </p>
                  ) : (
                    <p style={{ margin: '8px 0' }}>
                      Fecha límite: {lastAbono.apartado.fechaLimite?.toDate?.()?.toLocaleDateString('es-CO')}
                    </p>
                  )}
                  <p style={{ margin: '12px 0 4px 0' }}>
                    Gracias por su abono
                  </p>
                </div>
                </div>
              </div>
            </div>

            {/* Botones - Fijos abajo */}
            <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
              <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAbonoReceiptModal(false);
                  setLastAbono(null);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cerrar
              </button>
                <button
                  onClick={handlePrintAbono}
                  className="px-6 py-2 text-white rounded-lg hover:opacity-90 font-medium flex items-center gap-2"
                  style={{ backgroundColor: '#D50565' }}
                >
                  <Printer size={18} />
                  Imprimir Recibo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Imprimir Factura de Apartado */}
      {showFacturaModal && facturaData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full flex flex-col" style={{ maxWidth: '400px', maxHeight: '90vh' }}>

            {/* Header - Fijo arriba */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Factura de Venta</h2>
                <button
                  onClick={() => {
                    setShowFacturaModal(false);
                    setFacturaData(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Receipt Preview - Con scroll si es necesario */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex justify-center">
                <div id="factura-print" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', lineHeight: '1.4', maxWidth: '300px' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px dashed #000' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                    {companyConfig?.nombre || 'UNIFORMES MARTHA ROMERO'}
                  </h2>
                  {companyConfig?.direccion && (
                    <p style={{ margin: '4px 0', fontSize: '11px' }}>{companyConfig.direccion}</p>
                  )}
                  {companyConfig?.telefono && (
                    <p style={{ margin: '4px 0', fontSize: '11px' }}>Tel: {companyConfig.telefono}</p>
                  )}
                  {companyConfig?.nit && (
                    <p style={{ margin: '4px 0', fontSize: '11px' }}>NIT: {companyConfig.nit}</p>
                  )}
                </div>

                {/* Tipo de documento */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                    FACTURA DE VENTA
                  </h3>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
                    N° {facturaData.numeroFactura}
                  </p>
                  <p style={{ fontSize: '10px', margin: '4px 0' }}>
                    {facturaData.fecha?.toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <p style={{ fontSize: '10px', margin: '4px 0', fontStyle: 'italic', color: '#666' }}>
                    (Apartado Completado)
                  </p>
                </div>

                {/* Info del cliente */}
                <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #ddd', fontSize: '11px' }}>
                  <p style={{ margin: '4px 0' }}>
                    <strong>Cliente:</strong> {facturaData.clienteNombre}
                  </p>
                  {facturaData.clienteTelefono && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>Teléfono:</strong> {facturaData.clienteTelefono}
                    </p>
                  )}
                  {facturaData.clienteDocumento && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>Documento:</strong> {facturaData.clienteDocumento}
                    </p>
                  )}
                </div>

                {/* Items */}
                <div style={{ marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #000' }}>
                        <th style={{ padding: '4px', textAlign: 'left' }}>Producto</th>
                        <th style={{ padding: '4px', textAlign: 'center' }}>Cant.</th>
                        <th style={{ padding: '4px', textAlign: 'right' }}>Precio</th>
                        <th style={{ padding: '4px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturaData.items?.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px dashed #ddd' }}>
                          <td style={{ padding: '6px 4px' }}>
                            <div>{item.nombre}</div>
                            <div style={{ fontSize: '9px', color: '#666' }}>Talla: {item.talla}</div>
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>{item.cantidad}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                            ${item.precioUnitario?.toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>
                            ${item.subtotal?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totales */}
                <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '2px solid #000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                    <span>SUBTOTAL:</span>
                    <span>${facturaData.subtotal?.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                    <span>TOTAL:</span>
                    <span>${facturaData.totalVenta?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Desglose de pagos */}
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '11px' }}>
                  <p style={{ margin: '4px 0', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px' }}>
                    DESGLOSE DE PAGOS
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0' }}>
                    <span>Abonos previos:</span>
                    <span>${facturaData.totalAbonoPrevio?.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontWeight: 'bold', color: '#16a34a' }}>
                    <span>Pago final ({facturaData.metodoPago}):</span>
                    <span>${facturaData.pagoFinal?.toLocaleString()}</span>
                  </div>
                  {facturaData.cambio > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontWeight: 'bold' }}>
                      <span>Cambio:</span>
                      <span>${facturaData.cambio?.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '2px dashed #000', margin: '12px 0' }}></div>

                {/* Footer */}
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#666', marginTop: '12px' }}>
                  <p style={{ margin: '8px 0', fontWeight: 'bold' }}>
                    ¡Gracias por su compra!
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    Este documento es su comprobante de pago
                  </p>
                </div>
                </div>
              </div>
            </div>

            {/* Botones - Fijos abajo */}
            <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
              <div className="flex gap-3">
                <button
                onClick={() => {
                  setShowFacturaModal(false);
                  setFacturaData(null);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  const receiptElement = document.getElementById('factura-print');
                  if (!receiptElement) {
                    alert('No se pudo encontrar el contenido de la factura');
                    return;
                  }

                  const printWindow = window.open('', '_blank', 'width=800,height=700');
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="UTF-8">
                      <title>Factura N° ${facturaData.numeroFactura}</title>
                      <style>
                        @page { size: 80mm auto; margin: 0; }
                        * { box-sizing: border-box; }
                        body {
                          margin: 0;
                          padding: 0;
                          font-family: Arial, sans-serif;
                          display: flex;
                          justify-content: center;
                          background: #f0f0f0;
                        }
                        #receipt-container {
                          width: 80mm;
                          max-width: 80mm;
                          background: white;
                          margin: 0;
                        }
                      </style>
                    </head>
                    <body>
                      <div id="receipt-container">${receiptElement.innerHTML}</div>
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.onload = () => {
                    setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                    }, 250);
                  };
                }}
                className="px-6 py-2 text-white rounded-lg hover:opacity-90 font-medium flex items-center gap-2"
                style={{ backgroundColor: '#EA5C2E' }}
              >
                  <Printer size={18} />
                  Imprimir Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Enviar Apartado por Correo</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico del Cliente
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                disabled={sendingEmail}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#D50565' }}
              >
                {sendingEmail ? '📤 Enviando...' : '📧 Enviar'}
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Método de Pago para Facturación */}
      {showMetodoPagoModal && selectedApartado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Facturación de Apartado</h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">
                <strong>Cliente:</strong> {selectedApartado.clienteNombre}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Total del apartado:</strong> ${selectedApartado.totalApartado.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Ya abonado:</strong> ${selectedApartado.totalAbonado.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 font-semibold">
                <strong>Saldo pendiente:</strong> ${(selectedApartado.saldoPendiente || 0).toLocaleString()}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Pagar Hoy
              </label>
              <input
                type="number"
                value={montoPagoFactura}
                onChange={(e) => setMontoPagoFactura(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                min={selectedApartado.saldoPendiente || 0}
                step="100"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={metodoPagoFactura}
                onChange={(e) => setMetodoPagoFactura(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option>Efectivo</option>
                <option>Nequi</option>
                <option>Daviplata</option>
                <option>Nu</option>
                <option>Tarjeta</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={procesarFacturacionApartado}
                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#D50565' }}
              >
                Confirmar Facturación
              </button>
              <button
                onClick={() => setShowMetodoPagoModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Corrección de Producto en Apartado */}
      {showCorreccionProductoModal && selectedApartado && itemIndexToCorrect !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-800">
              Corregir Producto en Apartado #{selectedApartado.numeroApartado}
            </h3>

            {/* Producto Actual */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-800 mb-2">Producto Actual:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Producto:</span>{' '}
                  <span className="font-semibold">{selectedApartado.items[itemIndexToCorrect].nombre}</span>
                </div>
                <div>
                  <span className="text-gray-600">Talla:</span>{' '}
                  <span className="font-semibold">{selectedApartado.items[itemIndexToCorrect].talla}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cantidad:</span>{' '}
                  <span className="font-semibold">{selectedApartado.items[itemIndexToCorrect].cantidad}</span>
                </div>
                <div>
                  <span className="text-gray-600">Precio:</span>{' '}
                  <span className="font-semibold">${selectedApartado.items[itemIndexToCorrect].precio?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Buscar Nuevo Producto (Opcional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cambiar Producto (opcional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Deja vacío si solo quieres cambiar la cantidad
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre, referencia o talla..."
                  value={searchProductoCorreccion}
                  onChange={(e) => setSearchProductoCorreccion(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            {/* Lista de productos filtrados */}
            {searchProductoCorreccion && (
              <div className="mb-4 border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                {ordenarPorTalla(
                  productos.filter(p => {
                    const searchLower = searchProductoCorreccion.toLowerCase();
                    const matchSearch = (
                      p.nombre?.toLowerCase().includes(searchLower) ||
                      p.referencia?.toLowerCase().includes(searchLower) ||
                      p.talla?.toLowerCase().includes(searchLower)
                    );

                    // Si el apartado tiene colegio, filtrar por colegio del apartado
                    if (selectedApartado?.colegioId && selectedApartado.colegioId !== 'GENERAL') {
                      const colegioSeleccionado = colegios.find(c => c.id === selectedApartado.colegioId);
                      const codigoColegio = colegioSeleccionado?.codigo || selectedApartado.colegioId;

                      // Incluir productos del colegio O productos OT (generales)
                      const colegioMatch = p.colegio === codigoColegio || p.colegio === 'OT';
                      return matchSearch && colegioMatch;
                    }

                    return matchSearch;
                  })
                ).map(producto => (
                    <div
                      key={producto.id}
                      onClick={() => {
                        setProductoNuevoSeleccionado(producto);
                        setSearchProductoCorreccion('');
                      }}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">{producto.nombre}</p>
                          <p className="text-sm text-gray-600">
                            Ref: {producto.referencia} | Talla: {producto.talla}
                          </p>
                        </div>
                        <p className="font-semibold text-gray-800">${producto.precio?.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Producto Nuevo Seleccionado */}
            {productoNuevoSeleccionado && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-green-800 mb-2">Nuevo Producto Seleccionado:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Producto:</span>{' '}
                    <span className="font-semibold">{productoNuevoSeleccionado.nombre}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Talla:</span>{' '}
                    <span className="font-semibold">{productoNuevoSeleccionado.talla}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Referencia:</span>{' '}
                    <span className="font-semibold">{productoNuevoSeleccionado.referencia}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Precio:</span>{' '}
                    <span className="font-semibold">${productoNuevoSeleccionado.precio?.toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => setProductoNuevoSeleccionado(null)}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Cancelar selección
                </button>
              </div>
            )}

            {/* Campo de Cantidad */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad:
              </label>
              <input
                type="number"
                min="1"
                value={nuevaCantidadCorreccion}
                onChange={(e) => setNuevaCantidadCorreccion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cantidad actual: {selectedApartado.items[itemIndexToCorrect].cantidad}
              </p>
            </div>

            {/* Notas de la Corrección */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas de la Corrección (requerido):
              </label>
              <textarea
                value={notasCorreccion}
                onChange={(e) => setNotasCorreccion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                rows="3"
                placeholder="Explica el motivo de la corrección..."
                required
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={handleCorregirProductoApartado}
                disabled={corrigiendoProducto}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-opacity disabled:opacity-50"
              >
                {corrigiendoProducto ? 'Corrigiendo...' : 'Corregir Apartado'}
              </button>
              <button
                onClick={handleCloseCorreccionProducto}
                disabled={corrigiendoProducto}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Anular Producto */}
      {showAnularProductoModal && selectedApartado && itemIndexToAnular !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-gray-800">
              ⚠️ Anular Producto
            </h3>

            {/* Información del producto a anular */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-red-800 mb-2">Producto a Anular:</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Producto:</span>{' '}
                  <span className="font-semibold">{selectedApartado.items[itemIndexToAnular].nombre}</span>
                </div>
                <div>
                  <span className="text-gray-600">Talla:</span>{' '}
                  <span className="font-semibold">{selectedApartado.items[itemIndexToAnular].talla}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cantidad:</span>{' '}
                  <span className="font-semibold">{selectedApartado.items[itemIndexToAnular].cantidad}</span>
                </div>
                <div>
                  <span className="text-gray-600">Subtotal:</span>{' '}
                  <span className="font-semibold">${selectedApartado.items[itemIndexToAnular].subtotal?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Advertencia */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Esta acción:</strong>
              </p>
              <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                <li>Liberará el inventario reservado</li>
                <li>Reducirá el total del apartado</li>
                <li>El producto quedará visible como ANULADO</li>
                <li>Se guardará en el historial para auditoría</li>
              </ul>
            </div>

            {/* Campo de motivo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la Anulación (requerido):
              </label>
              <textarea
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                rows="3"
                placeholder="Ej: Producto agregado por error, cliente cambió de opinión, etc."
                required
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={handleAnularProducto}
                disabled={anulandoProducto}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-opacity disabled:opacity-50"
              >
                {anulandoProducto ? 'Anulando...' : 'Anular Producto'}
              </button>
              <button
                onClick={handleCloseAnularProducto}
                disabled={anulandoProducto}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Print Styles */}
      <style>{`
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
          #receipt-print,
          #receipt-print * {
            visibility: visible !important;
          }

          /* Posicionar el recibo */
          #receipt-print {
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
          #receipt-print * {
            max-width: 100% !important;
            color: black !important;
          }

          /* Optimizar colores para impresión */
          #receipt-print {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Asegurar que las tablas se vean bien */
          #receipt-print table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          #receipt-print table td,
          #receipt-print table th {
            padding: 1mm 0 !important;
            font-size: 10pt !important;
          }

          /* Líneas divisoras */
          #receipt-print .border-dashed {
            border-style: dashed !important;
            border-color: #000 !important;
          }

          #receipt-print .border-t {
            border-top-width: 1px !important;
          }

          #receipt-print .border-b {
            border-bottom-width: 1px !important;
          }

          /* Evitar saltos de página */
          #receipt-print {
            page-break-inside: avoid !important;
          }

          #receipt-print table {
            page-break-inside: auto !important;
          }

          #receipt-print tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
        }
      `}</style>

      {/* MODAL DE CAMBIO DE MÉTODO DE PAGO DE ABONO */}
      {showCambiarMetodoPagoAbonoModal && selectedApartado && abonoIndexToEdit !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Cambiar Método de Pago de Abono</h2>
              <button
                onClick={handleCloseCambiarMetodoPagoAbono}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Información del abono */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Abono Actual:</h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Apartado:</span>{' '}
                  <span className="font-semibold">#{selectedApartado.numeroApartado}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fecha:</span>{' '}
                  <span className="font-semibold">
                    {selectedApartado.historialAbonos[abonoIndexToEdit].fecha?.toDate?.()?.toLocaleDateString('es-CO') ||
                     new Date(selectedApartado.historialAbonos[abonoIndexToEdit].fecha).toLocaleDateString('es-CO')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Monto:</span>{' '}
                  <span className="font-semibold">${selectedApartado.historialAbonos[abonoIndexToEdit].monto.toLocaleString('es-CO')}</span>
                </div>
                <div>
                  <span className="text-gray-600">Método Actual:</span>{' '}
                  <span className="font-semibold text-lg">{selectedApartado.historialAbonos[abonoIndexToEdit].metodoPago || 'Efectivo'}</span>
                </div>
              </div>
            </div>

            {/* Selector de nuevo método */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nuevo Método de Pago:
              </label>
              <select
                value={nuevoMetodoPagoAbono}
                onChange={(e) => setNuevoMetodoPagoAbono(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Nequi">Nequi</option>
                <option value="Daviplata">Daviplata</option>
                <option value="Nu">Nu</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mixto">Mixto</option>
              </select>
            </div>

            {/* Notas de corrección */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (obligatorio):
              </label>
              <textarea
                value={notasMetodoPagoAbono}
                onChange={(e) => setNotasMetodoPagoAbono(e.target.value)}
                placeholder="Ej: Se registró como efectivo pero fue pago por Nequi..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={handleCambiarMetodoPagoAbono}
                disabled={cambiandoMetodoPagoAbono || !notasMetodoPagoAbono.trim() || nuevoMetodoPagoAbono === (selectedApartado.historialAbonos[abonoIndexToEdit].metodoPago || 'Efectivo')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cambiandoMetodoPagoAbono ? '⏳ Cambiando...' : '✓ Cambiar Método'}
              </button>
              <button
                onClick={handleCloseCambiarMetodoPagoAbono}
                disabled={cambiandoMetodoPagoAbono}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Cliente */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                Crear Cliente
              </h2>
              <button
                onClick={() => {
                  setShowClientModal(false);
                  setNewClientData({
                    nombreCompleto: '',
                    tipoDocumento: 'Cédula de Ciudadanía',
                    numeroDocumento: '',
                    telefono: '',
                    email: '',
                    direccion: '',
                    ciudad: '',
                    colegioId: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre Completo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientData.nombreCompleto}
                    onChange={(e) => setNewClientData({ ...newClientData, nombreCompleto: e.target.value })}
                    placeholder="Ej: Juan Pérez García"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Tipo de Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newClientData.tipoDocumento}
                    onChange={(e) => setNewClientData({ ...newClientData, tipoDocumento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  >
                    {tiposDocumento.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Número de Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientData.numeroDocumento}
                    onChange={(e) => setNewClientData({ ...newClientData, numeroDocumento: e.target.value })}
                    placeholder="Ej: 123456789"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={newClientData.telefono}
                    onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
                    placeholder="Ej: 3001234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    placeholder="Ej: cliente@ejemplo.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Dirección */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newClientData.direccion}
                    onChange={(e) => setNewClientData({ ...newClientData, direccion: e.target.value })}
                    placeholder="Ej: Calle 123 # 45-67"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={newClientData.ciudad}
                    onChange={(e) => setNewClientData({ ...newClientData, ciudad: e.target.value })}
                    placeholder="Ej: Bogotá"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Colegio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colegio (Opcional)
                  </label>
                  <select
                    value={newClientData.colegioId}
                    onChange={(e) => setNewClientData({ ...newClientData, colegioId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  >
                    <option value="">Sin colegio asignado</option>
                    {colegios.map(colegio => (
                      <option key={colegio.id} value={colegio.id}>
                        {colegio.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowClientModal(false);
                  setNewClientData({
                    nombreCompleto: '',
                    tipoDocumento: 'Cédula de Ciudadanía',
                    numeroDocumento: '',
                    telefono: '',
                    email: '',
                    direccion: '',
                    ciudad: '',
                    colegioId: ''
                  });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateClient}
                style={{ backgroundColor: '#D50565' }}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Apartados;
