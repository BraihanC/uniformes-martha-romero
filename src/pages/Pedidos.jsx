import { useState, useEffect } from 'react';
import { db, functions } from '../services/firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  orderBy,
  limit,
  addDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../context/AuthContext';
import { Phone } from 'lucide-react';

const Pedidos = () => {
  const { currentUser } = useAuth();

  // Estados para datos
  const [allClients, setAllClients] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [allColegios, setAllColegios] = useState([]);
  const [selectedColegioId, setSelectedColegioId] = useState(''); // Para el formulario

  // Estados para modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [reciboDatos, setReciboDatos] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  // Estados para nuevo cliente
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

  // Estados para el formulario de creación
  const [selectedClient, setSelectedClient] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [abono, setAbono] = useState(0);
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  // Estados para búsqueda
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);

  // Estados para filtros de pedidos
  const [filterEstado, setFilterEstado] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Estado para búsqueda

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const pedidosPorPagina = 10;

  // Estados para gestión de pedido
  const [selectedItemsForDelivery, setSelectedItemsForDelivery] = useState([]);
  const [nuevoAbono, setNuevoAbono] = useState(0);
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState('Efectivo');
  const [showAbonoForm, setShowAbonoForm] = useState(false);

  // Estados para abonos adicionales (sin entrega)
  const [abonoAdicionalMonto, setAbonoAdicionalMonto] = useState(0);
  const [abonoAdicionalMetodo, setAbonoAdicionalMetodo] = useState('Efectivo');

  // Estado para datos de la empresa
  const [companyConfig, setCompanyConfig] = useState(null);

  const [loading, setLoading] = useState(false);

  // Cargar datos al iniciar
  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchPedidos();
    fetchCompanyConfig();
    fetchColegios();
  }, []);

  const fetchCompanyConfig = async () => {
    try {
      const companyDoc = await getDoc(doc(db, 'config', 'company'));
      if (companyDoc.exists()) {
        setCompanyConfig(companyDoc.data());
      }
    } catch (error) {
      console.error('Error al cargar configuración de empresa:', error);
    }
  };

  const fetchColegios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'colegios'));
      const colegiosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      colegiosData.sort((a, b) => a.nombre.localeCompare(b.nombre)); // Ordenar alfabéticamente
      setAllColegios(colegiosData);
    } catch (error) {
      console.error('Error al cargar colegios:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'clients'));
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllClients(clientsData);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllProducts(productsData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'pedidos'));
      const pedidosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      pedidosData.sort((a, b) => (b.numeroPedido || 0) - (a.numeroPedido || 0));
      setPedidos(pedidosData);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda de clientes en tiempo real
  useEffect(() => {
    if (!clientSearchTerm.trim()) {
      setClientSearchResults([]);
      return;
    }

    const searchLower = clientSearchTerm.toLowerCase();
    const filtered = allClients.filter(client => {
      const nombreMatch = client.nombreCompleto?.toLowerCase().includes(searchLower);
      const documentoMatch = client.numeroDocumento?.toLowerCase().includes(searchLower);
      return nombreMatch || documentoMatch;
    });

    setClientSearchResults(filtered);
  }, [clientSearchTerm, allClients]);

  // Búsqueda de productos en tiempo real
  useEffect(() => {
    if (!productSearchTerm.trim()) {
      setProductSearchResults([]);
      return;
    }

    const searchLower = productSearchTerm.toLowerCase();
    const filtered = allProducts.filter(product => {
      const nombreMatch = product.nombre?.toLowerCase().includes(searchLower);
      const referenciaMatch = product.referencia?.toLowerCase().includes(searchLower);
      return nombreMatch || referenciaMatch;
    });

    setProductSearchResults(filtered);
  }, [productSearchTerm, allProducts]);

  // Funciones para el formulario de creación
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearchTerm('');
    setClientSearchResults([]);
  };

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
      setAllClients([...allClients, clientWithId]);

      // Seleccionar el cliente recién creado
      setSelectedClient(clientWithId);
      setClientSearchTerm(clientWithId.nombreCompleto);

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

  const handleAddProduct = (product) => {
    const exists = cartItems.find(item => item.product.id === product.id);
    if (exists) {
      alert('Este producto ya está en el carrito.');
      return;
    }

    const newItem = {
      product: product,
      cantidad: 1,
      precio: product.precio || 0
    };

    setCartItems([...cartItems, newItem]);
    setProductSearchTerm('');
    setProductSearchResults([]);
  };

  const handleUpdateQuantity = (index, cantidad) => {
    const updated = [...cartItems];
    updated[index].cantidad = Number(cantidad);
    setCartItems(updated);
  };

  const handleUpdatePrice = (index, precio) => {
    const updated = [...cartItems];
    updated[index].precio = Number(precio);
    setCartItems(updated);
  };

  const handleRemoveFromCart = (index) => {
    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  };

  const calculateSaldoPendiente = () => {
    return calculateTotal() - (Number(abono) || 0);
  };

  // Guardar pedido (PARTE 2)
  const handleSavePedido = async (e) => {
    e.preventDefault();

    if (!selectedClient) {
      alert('Por favor, selecciona un cliente.');
      return;
    }

    if (cartItems.length === 0) {
      alert('Por favor, añade al menos un producto al pedido.');
      return;
    }

    if (!selectedColegioId) {
      alert('Por favor, selecciona un colegio.');
      return;
    }

    setLoading(true);
    try {
      // Obtener el número de pedido consecutivo
      const q = query(collection(db, 'pedidos'), orderBy('numeroPedido', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      let nextNumero = 1;
      if (!snapshot.empty) {
        const lastPedido = snapshot.docs[0].data();
        nextNumero = (lastPedido.numeroPedido || 0) + 1;
      }

      const batch = writeBatch(db);

      // Formatear items con estado inicial
      const itemsConEstado = cartItems.map(item => ({
        productoId: item.product.id,
        referencia: item.product.referencia,
        nombre: item.product.nombre,
        talla: item.product.talla,
        cantidad: item.cantidad,
        precio: item.precio,
        subtotal: item.cantidad * item.precio,
        estadoItem: 'En Producción' // Estado inicial
      }));

      const totalPedido = calculateTotal();
      const abonoInicial = Number(abono) || 0;

      // Busca el colegio seleccionado
      const selectedColegio = allColegios.find(c => c.id === selectedColegioId);
      const colegioNombre = selectedColegio ? selectedColegio.nombre : 'General (Sin Colegio)';

      // Paso A: Crear el pedido
      const pedidoRef = doc(collection(db, 'pedidos'));
      const pedidoData = {
        numeroPedido: nextNumero,
        clienteId: selectedClient.id,
        clienteNombre: selectedClient.nombreCompleto,
        clienteDocumento: selectedClient.numeroDocumento,
        colegioId: selectedColegioId,
        colegioNombre: colegioNombre,
        items: itemsConEstado,
        total: totalPedido,
        totalAbonado: abonoInicial,
        saldoPendiente: totalPedido - abonoInicial,
        abonos: abonoInicial > 0 ? [{
          monto: abonoInicial,
          metodoPago: metodoPago,
          fecha: new Date().toISOString()
        }] : [],
        observaciones: observaciones.trim(),
        estadoGeneral: 'En Proceso',
        createdAt: serverTimestamp(),
        userId: currentUser.uid
      };

      batch.set(pedidoRef, pedidoData);

      // Paso B: Actualizar inventario de cada producto
      cartItems.forEach(item => {
        const productRef = doc(db, 'products', item.product.id);
        batch.update(productRef, {
          stockTotal: increment(item.cantidad),
          stockReservadoPedidos: increment(item.cantidad),
          updatedAt: serverTimestamp()
        });
      });

      // 5. (NUEVO) Registrar Transacción de Abono Inicial (si existe)
      if (abonoInicial > 0) {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'abono_pedido',
          monto: abonoInicial,
          metodoPago: metodoPago,
          pedidoId: pedidoRef.id,
          descripcion: `Abono inicial Pedido #${nextNumero}`,
          clienteId: selectedClient.id,
          clienteNombre: selectedClient.nombreCompleto,
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });
      }

      // Paso C: Commit
      await batch.commit();

      alert(`¡Pedido #${nextNumero} creado correctamente!`);

      // Guardar datos para la tirilla
      setReciboDatos({
        pedidoId: pedidoRef.id,
        numeroPedido: nextNumero,
        clienteNombre: selectedClient.nombreCompleto,
        clienteId: selectedClient.id,
        colegioNombre: colegioNombre,
        items: itemsConEstado,
        total: totalPedido,
        abono: abonoInicial,
        saldo: totalPedido - abonoInicial,
        fecha: new Date().toLocaleDateString('es-CO'),
        observaciones: observaciones.trim()
      });

      // Limpiar formulario
      handleCancelCreateForm();
      fetchPedidos();
    } catch (error) {
      console.error('Error al crear pedido:', error);
      alert('Error al crear el pedido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCreateForm = () => {
    setShowCreateModal(false);
    setSelectedClient(null);
    setCartItems([]);
    setObservaciones('');
    setAbono(0);
    setMetodoPago('Efectivo');
    setSelectedColegioId('');
    setClientSearchTerm('');
    setProductSearchTerm('');
    setClientSearchResults([]);
    setProductSearchResults([]);
  };


  // Abrir modal de gestión (PARTE 3)
  const handleOpenManagePedido = async (pedidoId) => {
    setLoading(true);
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      const pedidoSnap = await getDoc(pedidoRef);

      if (pedidoSnap.exists()) {
        setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
        setShowManageModal(true);
        setSelectedItemsForDelivery([]);
        setNuevoAbono(0);
        setShowAbonoForm(false);
        setAbonoAdicionalMonto(0);
        setAbonoAdicionalMetodo('Efectivo');
      }
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      alert('Error al cargar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  // Nueva función para manejar el cambio de estado con el <select>
  const handleUpdateItemEstado = async (itemIndex, nuevoEstado) => {
    if (!selectedPedido) return;

    // Evitar cambios si el estado ya es el mismo
    if (selectedPedido.items[itemIndex].estadoItem === nuevoEstado) return;

    setLoading(true);
    try {
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // 1. Actualizar el estado del item específico
      const updatedItems = [...selectedPedido.items];
      updatedItems[itemIndex].estadoItem = nuevoEstado;

      // 2. Recalcular el estado general del pedido
      const anyInProduction = updatedItems.some(item => item.estadoItem === 'En Producción');

      // Considera 'Listo' o 'Entregado' como completos para esta lógica
      const allItemsReadyOrDelivered = updatedItems.every(
        item => item.estadoItem === 'Listo para Entrega' || item.estadoItem === 'Entregado'
      );

      let nuevoEstadoGeneral;
      if (anyInProduction) {
        nuevoEstadoGeneral = 'En Proceso';
      } else if (allItemsReadyOrDelivered) {
        nuevoEstadoGeneral = 'Pedido Completo - Listo para Recoger';
      } else {
        // Esto cubre casos mixtos, ej: 1 'Listo', 1 'Entregado', pero 0 'En Producción'
        nuevoEstadoGeneral = selectedPedido.estadoGeneral;
      }

      // Si todos están entregados, el estado general será 'Entregado'
      const todosEntregados = updatedItems.every(item => item.estadoItem === 'Entregado');
      if (todosEntregados) {
        nuevoEstadoGeneral = 'Entregado';
      }

      // 3. Actualizar el pedido en la base de datos
      await updateDoc(pedidoRef, {
        items: updatedItems,
        estadoGeneral: nuevoEstadoGeneral,
        updatedAt: serverTimestamp()
      });

      // 4. Recargar el estado local
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });

      // 5. Refrescar la lista principal de pedidos
      fetchPedidos();

    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar el estado.');
    } finally {
      setLoading(false);
    }
  };

  // Sub-Módulo 2: Toggle selección de item para entrega
  const handleToggleItemForDelivery = (itemIndex) => {
    if (selectedItemsForDelivery.includes(itemIndex)) {
      setSelectedItemsForDelivery(selectedItemsForDelivery.filter(i => i !== itemIndex));
    } else {
      setSelectedItemsForDelivery([...selectedItemsForDelivery, itemIndex]);
    }
  };

  // Sub-Módulo 2: Registrar Entrega Parcial (PARTE 3)
  const handleRegistrarEntregaParcial = async () => {
    if (!selectedPedido || selectedItemsForDelivery.length === 0) {
      alert('Por favor, selecciona al menos un ítem para entregar.');
      return;
    }

    // Paso A: Calcular valor de entrega
    const valorDeEntrega = selectedItemsForDelivery.reduce((sum, index) => {
      const item = selectedPedido.items[index];
      return sum + item.subtotal;
    }, 0);

    // Paso B y C: Validar abono
    const totalAbonado = selectedPedido.totalAbonado || 0;
    const saldoPendiente = selectedPedido.saldoPendiente || 0;

    // Alerta si está llevando más de lo abonado
    if (valorDeEntrega > totalAbonado) {
      const saldoAPagar = valorDeEntrega - totalAbonado;
      alert(`⚠️ El cliente está llevando más valor del que ha abonado.\n\nValor de entrega: $${valorDeEntrega.toLocaleString('es-CO')}\nTotal abonado: $${totalAbonado.toLocaleString('es-CO')}\nSaldo a pagar hoy: $${saldoAPagar.toLocaleString('es-CO')}`);
      setShowAbonoForm(true);
      return;
    }

    // Si todo está OK, proceder con la entrega
    await confirmarEntrega();
  };

  const confirmarEntrega = async () => {
    if (!selectedPedido) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // Calcular nuevo total abonado y saldo
      const valorDeEntrega = selectedItemsForDelivery.reduce((sum, index) => {
        return sum + selectedPedido.items[index].subtotal;
      }, 0);

      const abonoNuevo = Number(nuevoAbono) || 0;
      const nuevoTotalAbonado = (selectedPedido.totalAbonado || 0) + abonoNuevo;
      const nuevoSaldoPendiente = selectedPedido.total - nuevoTotalAbonado;

      // Actualizar items: cambiar estado a "Entregado"
      const updatedItems = selectedPedido.items.map((item, index) => {
        if (selectedItemsForDelivery.includes(index)) {
          return { ...item, estadoItem: 'Entregado' };
        }
        return item;
      });

      // Actualizar abonos si hay nuevo abono
      const updatedAbonos = [...(selectedPedido.abonos || [])];
      if (abonoNuevo > 0) {
        updatedAbonos.push({
          monto: abonoNuevo,
          metodoPago: nuevoMetodoPago,
          fecha: new Date().toISOString()
        });
      }

      // 1. Actualizar Pedido
      batch.update(pedidoRef, {
        items: updatedItems,
        totalAbonado: nuevoTotalAbonado,
        saldoPendiente: nuevoSaldoPendiente,
        abonos: updatedAbonos,
        updatedAt: serverTimestamp()
      });

      // 2. Actualizar Inventario (reducir stock)
      selectedItemsForDelivery.forEach(index => {
        const item = selectedPedido.items[index];
        const productRef = doc(db, 'products', item.productoId);
        batch.update(productRef, {
          stockTotal: increment(-item.cantidad),
          stockReservadoPedidos: increment(-item.cantidad),
          updatedAt: serverTimestamp()
        });
      });

      // 3. (NUEVO) Registrar Transacción de Abono (si existe)
      if (abonoNuevo > 0) {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'abono_pedido',
          monto: abonoNuevo,
          metodoPago: nuevoMetodoPago,
          pedidoId: pedidoRef.id,
          descripcion: `Abono en entrega Pedido #${selectedPedido.numeroPedido}`,
          clienteId: selectedPedido.clienteId,
          clienteNombre: selectedPedido.clienteNombre,
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });
      }

      // 4. Commit
      await batch.commit();

      // Verificar si todos los items están entregados
      const todosEntregados = updatedItems.every(item => item.estadoItem === 'Entregado');

      if (todosEntregados) {
        await updateDoc(pedidoRef, {
          estadoGeneral: 'Entregado',
          updatedAt: serverTimestamp()
        });
      }

      alert('Entrega registrada correctamente.');

      // Recargar
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      setSelectedItemsForDelivery([]);
      setNuevoAbono(0);
      setShowAbonoForm(false);
      fetchPedidos();
    } catch (error) {
      console.error('Error al registrar entrega:', error);
      alert('Error al registrar la entrega.');
    } finally {
      setLoading(false);
    }
  };

  // Registrar Abono Adicional (sin entrega de productos)
  const handleRegistrarAbonoAdicional = async (e) => {
    e.preventDefault();

    if (!selectedPedido) return;

    const monto = Number(abonoAdicionalMonto);
    if (monto <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      const nuevoTotalAbonado = (selectedPedido.totalAbonado || 0) + monto;
      const nuevoSaldoPendiente = selectedPedido.total - nuevoTotalAbonado;

      // 1. Preparar lista de abonos actualizada
      const updatedAbonos = [...(selectedPedido.abonos || [])];
      updatedAbonos.push({
        monto: monto,
        metodoPago: abonoAdicionalMetodo,
        fecha: new Date().toISOString()
      });

      // 2. Actualizar el Pedido en el Batch
      batch.update(pedidoRef, {
        totalAbonado: nuevoTotalAbonado,
        saldoPendiente: nuevoSaldoPendiente,
        abonos: updatedAbonos,
        updatedAt: serverTimestamp()
      });

      // 3. (NUEVO) Registrar la Transacción en el Batch
      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, {
        tipo: 'abono_pedido',
        monto: monto,
        metodoPago: abonoAdicionalMetodo,
        pedidoId: selectedPedido.id,
        descripcion: `Abono adicional Pedido #${selectedPedido.numeroPedido}`,
        clienteId: selectedPedido.clienteId,
        clienteNombre: selectedPedido.clienteNombre,
        fecha: serverTimestamp(),
        userId: currentUser.uid
      });

      // 4. Commit atómico
      await batch.commit();

      alert('¡Abono registrado correctamente!');

      // Recargar el pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      setAbonoAdicionalMonto(0);
      setAbonoAdicionalMetodo('Efectivo');
      fetchPedidos();

    } catch (error) {
      console.error('Error al registrar abono:', error);
      alert('Error al registrar el abono. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Imprimir tirilla desde el modal de gestión
  const handleImprimirTirillaGestion = () => {
    if (!selectedPedido) {
      alert('No hay pedido seleccionado para imprimir.');
      return;
    }

    // Verificar que haya items
    if (!selectedPedido.items || selectedPedido.items.length === 0) {
      alert('El pedido no tiene productos para imprimir.');
      return;
    }

    // Preparar datos para la tirilla - esto hará visible el modal
    setReciboDatos({
      pedidoId: selectedPedido.id,
      numeroPedido: selectedPedido.numeroPedido,
      clienteNombre: selectedPedido.clienteNombre,
      clienteId: selectedPedido.clienteId,
      items: selectedPedido.items,
      total: selectedPedido.total,
      abono: selectedPedido.totalAbonado || 0,
      saldo: selectedPedido.saldoPendiente || 0,
      fecha: selectedPedido.createdAt?.toDate
        ? new Date(selectedPedido.createdAt.toDate()).toLocaleDateString('es-CO')
        : new Date().toLocaleDateString('es-CO'),
      observaciones: selectedPedido.observaciones || ''
    });
  };

  // Función común para imprimir
  const handlePrint = () => {
    window.print();
  };

  // ====== SEND EMAIL ======
  const handleOpenEmailModal = () => {
    // Pre-fill with client's email if available
    const clientEmail = allClients.find(c => c.id === reciboDatos?.clienteId)?.email || '';
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
      const sendPedidoEmail = httpsCallable(functions, 'sendPedidoEmail');
      const result = await sendPedidoEmail({
        pedidoId: reciboDatos.pedidoId,
        toEmail: emailRecipient.trim()
      });

      // Actualizar el email del cliente en la base de datos si se ingresó manualmente
      if (reciboDatos?.clienteId) {
        try {
          const clienteActual = allClients.find(c => c.id === reciboDatos.clienteId);
          // Solo actualizar si el email es diferente o no existe
          if (clienteActual && clienteActual.email !== emailRecipient.trim()) {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'clients', reciboDatos.clienteId), {
              email: emailRecipient.trim()
            });

            // Actualizar el cliente en el estado local
            setAllClients(prevClients =>
              prevClients.map(c =>
                c.id === reciboDatos.clienteId
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

  // Filtrar pedidos por estado y búsqueda
  const filteredPedidos = pedidos.filter(pedido => {
    // Filtro por estado
    const matchEstado = filterEstado ? pedido.estadoGeneral === filterEstado : true;

    // Filtro por búsqueda
    if (!searchTerm.trim()) {
      return matchEstado;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const matchNumero = String(pedido.numeroPedido || '').includes(searchTerm);
    const matchNombre = (pedido.clienteNombre || '').toLowerCase().includes(searchLower);
    const matchDocumento = (pedido.clienteDocumento || '').toLowerCase().includes(searchLower);

    // Buscar teléfono en los datos del cliente
    const clienteData = allClients.find(c => c.id === pedido.clienteId);
    const matchTelefono = clienteData ? (clienteData.telefono || '').includes(searchTerm) : false;

    const matchSearch = matchNumero || matchNombre || matchDocumento || matchTelefono;

    return matchEstado && matchSearch;
  });

  // Calcular paginación
  const totalPaginas = Math.ceil(filteredPedidos.length / pedidosPorPagina);
  const indiceInicio = (paginaActual - 1) * pedidosPorPagina;
  const indiceFin = indiceInicio + pedidosPorPagina;
  const pedidosPaginados = filteredPedidos.slice(indiceInicio, indiceFin);

  // Resetear página cuando cambia el filtro o la búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [filterEstado, searchTerm]);

  // Función helper para obtener color del badge de estado
  const getEstadoBadgeColor = (estado) => {
    switch(estado) {
      case 'En Proceso':
        return 'bg-blue-100 text-blue-800';
      case 'Pedido Completo - Listo para Recoger':
        return 'bg-yellow-100 text-yellow-800';
      case 'Entregado':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* PARTE 1: Vista Principal */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Pedidos de Producción</h1>
          <p className="text-gray-600 mt-1">Sistema integral de gestión de pedidos</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ backgroundColor: '#D50565' }}
          className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <span className="hidden sm:inline">+ Crear Nuevo Pedido</span>
          <span className="sm:hidden">+ Nuevo Pedido</span>
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 print:hidden">
        {/* Barra de búsqueda */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por número de pedido, cliente, teléfono o identificación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filtros por estado */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterEstado('')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
              filterEstado === '' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterEstado('En Proceso')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
              filterEstado === 'En Proceso' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            En Proceso
          </button>
          <button
            onClick={() => setFilterEstado('Pedido Completo - Listo para Recoger')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
              filterEstado === 'Pedido Completo - Listo para Recoger' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="hidden sm:inline">Pedido Completo</span>
            <span className="sm:hidden">Completo</span>
          </button>
          <button
            onClick={() => setFilterEstado('Entregado')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
              filterEstado === 'Entregado' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Entregado
          </button>
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden print:hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Lista de Pedidos</h2>
        </div>

        {loading && pedidos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Cargando pedidos...</div>
        ) : filteredPedidos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? (
              <>
                No se encontraron pedidos que coincidan con "{searchTerm}"
                {filterEstado && ` en estado "${filterEstado}"`}.
              </>
            ) : (
              <>No hay pedidos {filterEstado ? `en estado "${filterEstado}"` : 'registrados'}.</>
            )}
          </div>
        ) : (
          <>
            {/* Vista de Tarjetas - Solo Móvil */}
            <div className="md:hidden space-y-4">
              {pedidosPaginados.map((pedido) => (
                <div key={pedido.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  {/* Header de la tarjeta */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-mono font-bold text-lg text-gray-800">
                        #{String(pedido.numeroPedido).padStart(4, '0')}
                      </span>
                      <p className="font-medium text-gray-900 mt-1">{pedido.clienteNombre}</p>
                      {(() => {
                        const telefono = allClients.find(c => c.id === pedido.clienteId)?.telefono;
                        return telefono ? (
                          <a
                            href={`tel:${telefono}`}
                            className="text-sm hover:underline flex items-center gap-1 mt-1"
                            style={{ color: '#D50565' }}
                          >
                            <Phone size={12} />
                            {telefono}
                          </a>
                        ) : null;
                      })()}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoBadgeColor(pedido.estadoGeneral)}`}>
                      {pedido.estadoGeneral}
                    </span>
                  </div>

                  {/* Información del pedido */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Fecha:</span>
                      <p className="font-medium text-gray-900">
                        {pedido.createdAt?.toDate
                          ? new Date(pedido.createdAt.toDate()).toLocaleDateString('es-CO')
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <p className="font-bold text-gray-900">${pedido.total?.toLocaleString('es-CO')}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Saldo Pendiente:</span>
                      <p className="font-bold text-lg" style={{ color: '#D50565' }}>
                        ${pedido.saldoPendiente?.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>

                  {/* Botón de acción */}
                  <button
                    onClick={() => handleOpenManagePedido(pedido.id)}
                    className="w-full px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Gestionar Pedido
                  </button>
                </div>
              ))}
            </div>

            {/* Vista de Tabla - Solo Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Pedido</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado General</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Pendiente</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pedidosPaginados.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-gray-800">
                          #{String(pedido.numeroPedido).padStart(4, '0')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{pedido.clienteNombre}</p>
                        {(() => {
                          const telefono = allClients.find(c => c.id === pedido.clienteId)?.telefono;
                          return telefono ? (
                            <a
                              href={`tel:${telefono}`}
                              className="text-sm hover:underline flex items-center gap-1"
                              style={{ color: '#D50565' }}
                            >
                              <Phone size={12} />
                              {telefono}
                            </a>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {pedido.createdAt?.toDate
                          ? new Date(pedido.createdAt.toDate()).toLocaleDateString('es-CO')
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoBadgeColor(pedido.estadoGeneral)}`}>
                          {pedido.estadoGeneral}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-800">
                        ${pedido.total?.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium" style={{ color: '#D50565' }}>
                        ${pedido.saldoPendiente?.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleOpenManagePedido(pedido.id)}
                          className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Gestionar Pedido
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                  <span className="hidden sm:inline">
                    Mostrando {indiceInicio + 1}-{Math.min(indiceFin, filteredPedidos.length)} de {filteredPedidos.length} pedidos
                  </span>
                  <span className="sm:hidden">
                    {indiceInicio + 1}-{Math.min(indiceFin, filteredPedidos.length)} de {filteredPedidos.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => setPaginaActual(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="hidden sm:inline">Anterior</span>
                    <span className="sm:hidden">&larr;</span>
                  </button>
                  <div className="hidden sm:flex gap-2">
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
                      <button
                        key={numero}
                        onClick={() => setPaginaActual(numero)}
                        className={`px-3 py-1 text-sm border rounded-lg transition-colors ${
                          paginaActual === numero
                            ? 'bg-primary text-white border-primary'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {numero}
                      </button>
                    ))}
                  </div>
                  <span className="sm:hidden text-sm font-medium text-gray-700">
                    Pág. {paginaActual} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaActual(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <span className="sm:hidden">&rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PARTE 2: Modal de Creación de Pedido */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">Crear Nuevo Pedido</h2>
              <button
                type="button"
                onClick={() => setShowClientModal(true)}
                style={{ backgroundColor: '#D50565' }}
                className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                + Crear Cliente
              </button>
            </div>

            <form onSubmit={handleSavePedido} className="p-6 space-y-6">
              {/* Selector de Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente <span className="text-red-500">*</span>
                </label>
                {!selectedClient ? (
                  <div>
                    <input
                      type="text"
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      placeholder="Buscar cliente por nombre o documento..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {clientSearchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                        {clientSearchResults.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                          >
                            <p className="font-medium text-gray-800">{client.nombreCompleto}</p>
                            <p className="text-sm text-gray-600">{client.numeroDocumento}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{selectedClient.nombreCompleto}</p>
                      <p className="text-sm text-gray-600">{selectedClient.numeroDocumento}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedClient(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>

              {/* (NUEVO) SELECTOR DE COLEGIO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colegio (para producción) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedColegioId}
                  onChange={(e) => setSelectedColegioId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Seleccione un Colegio...</option>
                  <option value="GENERAL">General / Sin Colegio</option>
                  {allColegios.map((colegio) => (
                    <option key={colegio.id} value={colegio.id}>
                      {colegio.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buscador de Productos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar Productos
                </label>
                <input
                  type="text"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  placeholder="Buscar producto por nombre o referencia..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {productSearchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    {productSearchResults.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{product.nombre}</p>
                            <p className="text-sm text-gray-600">Ref: {product.referencia} | Talla: {product.talla}</p>
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            ${product.precio?.toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Carrito de Pedido */}
              {cartItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Productos del Pedido</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Precio</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cartItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{item.product.nombre}</p>
                              <p className="text-sm text-gray-600">Ref: {item.product.referencia} | Talla: {item.product.talla}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.cantidad}
                                onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.precio}
                                onChange={(e) => handleUpdatePrice(index, e.target.value)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              ${(item.cantidad * item.precio).toLocaleString('es-CO')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Abono y Método de Pago */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abono Inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={abono}
                    onChange={(e) => setAbono(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Nequi">Nequi</option>
                    <option value="Daviplata">Daviplata</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones (Medidas especiales, etc.)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows="3"
                  placeholder="Ej: Manga larga, talla especial..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Resumen */}
              {cartItems.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Total del Pedido:</span>
                    <span className="text-xl font-bold text-gray-800">
                      ${calculateTotal().toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Abono:</span>
                    <span className="text-lg font-medium text-gray-800">
                      ${(Number(abono) || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                    <span className="text-gray-700 font-medium">Saldo Pendiente:</span>
                    <span className="text-xl font-bold" style={{ color: '#D50565' }}>
                      ${calculateSaldoPendiente().toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 sticky bottom-0 bg-white pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading || !selectedClient || cartItems.length === 0}
                  style={{ backgroundColor: '#D50565' }}
                  className="flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : 'Guardar Pedido'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCreateForm}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* PARTE 3: Modal de Gestión de Pedido */}
      {showManageModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Cabecera */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Gestionar Pedido #{String(selectedPedido.numeroPedido).padStart(4, '0')}
                  </h2>
                  <p className="text-gray-600 mt-1">{selectedPedido.clienteNombre}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleImprimirTirillaGestion}
                    style={{ backgroundColor: '#D50565' }}
                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimir Tirilla
                  </button>
                  <button
                    onClick={() => setShowManageModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Resumen Financiero */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-lg font-bold text-gray-800">
                    ${selectedPedido.total?.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Total Abonado</p>
                  <p className="text-lg font-bold text-green-700">
                    ${(selectedPedido.totalAbonado || 0).toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Saldo Pendiente</p>
                  <p className="text-lg font-bold text-red-700">
                    ${(selectedPedido.saldoPendiente || 0).toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Sub-Módulo 1: Estado de Taller */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Estado de Taller (En Producción)
                </h3>
                {selectedPedido.items.filter(item => item.estadoItem === 'En Producción').length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay ítems en producción.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedPedido.items.map((item, index) => (
                          item.estadoItem === 'En Producción' && (
                            <tr key={index}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{item.nombre}</p>
                                <p className="text-sm text-gray-600">Ref: {item.referencia} | Talla: {item.talla}</p>
                              </td>
                              <td className="px-4 py-3 text-center">{item.cantidad}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {item.estadoItem}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <select
                                  value={item.estadoItem}
                                  onChange={(e) => handleUpdateItemEstado(index, e.target.value)}
                                  disabled={loading}
                                  className={`px-3 py-1 rounded text-xs border ${
                                    item.estadoItem === 'En Producción'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                  } focus:outline-none focus:ring-1 focus:ring-primary`}
                                >
                                  <option value="En Producción">En Producción</option>
                                  <option value="Listo para Entrega">Listo para Entrega</option>
                                </select>
                              </td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sub-Módulo 2: Registrar Entrega al Cliente */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Registrar Entrega al Cliente (Listos para Entrega)
                </h3>
                {selectedPedido.items.filter(item => item.estadoItem === 'Listo para Entrega').length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay ítems listos para entregar.</p>
                ) : (
                  <div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              <input
                                type="checkbox"
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const indices = selectedPedido.items
                                      .map((item, idx) => item.estadoItem === 'Listo para Entrega' ? idx : null)
                                      .filter(idx => idx !== null);
                                    setSelectedItemsForDelivery(indices);
                                  } else {
                                    setSelectedItemsForDelivery([]);
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedPedido.items.map((item, index) => (
                            item.estadoItem === 'Listo para Entrega' && (
                              <tr key={index} className={selectedItemsForDelivery.includes(index) ? 'bg-blue-50' : ''}>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedItemsForDelivery.includes(index)}
                                    onChange={() => handleToggleItemForDelivery(index)}
                                    className="rounded"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-800">{item.nombre}</p>
                                  <p className="text-sm text-gray-600">Ref: {item.referencia} | Talla: {item.talla}</p>
                                </td>
                                <td className="px-4 py-3 text-center">{item.cantidad}</td>
                                <td className="px-4 py-3 text-right font-medium">
                                  ${item.subtotal?.toLocaleString('es-CO')}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <select
                                    value={item.estadoItem}
                                    onChange={(e) => handleUpdateItemEstado(index, e.target.value)}
                                    disabled={loading}
                                    className={`px-3 py-1 rounded text-xs border ${
                                      item.estadoItem === 'En Producción'
                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                    } focus:outline-none focus:ring-1 focus:ring-primary`}
                                  >
                                    <option value="En Producción">En Producción</option>
                                    <option value="Listo para Entrega">Listo para Entrega</option>
                                  </select>
                                </td>
                              </tr>
                            )
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Formulario de Abono (si se requiere) */}
                    {showAbonoForm && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-yellow-800 mb-3">Se requiere abono adicional</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nuevo Abono
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={nuevoAbono}
                              onChange={(e) => setNuevoAbono(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Método de Pago
                            </label>
                            <select
                              value={nuevoMetodoPago}
                              onChange={(e) => setNuevoMetodoPago(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="Efectivo">Efectivo</option>
                              <option value="Nequi">Nequi</option>
                              <option value="Daviplata">Daviplata</option>
                              <option value="Transferencia">Transferencia</option>
                              <option value="Tarjeta">Tarjeta</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={showAbonoForm ? confirmarEntrega : handleRegistrarEntregaParcial}
                      disabled={loading || selectedItemsForDelivery.length === 0}
                      style={{ backgroundColor: '#D50565' }}
                      className="w-full px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Procesando...' : showAbonoForm ? 'Confirmar Entrega' :
                        (() => {
                          // Verificar si después de esta entrega, TODOS los items estarán entregados
                          const itemsQueQuedaranPendientes = selectedPedido.items.filter((item, index) => {
                            // Si este item ya está entregado, no cuenta como pendiente
                            if (item.estadoItem === 'Entregado') return false;
                            // Si este item está seleccionado para entrega ahora, no quedará pendiente
                            if (selectedItemsForDelivery.includes(index)) return false;
                            // Si llegamos aquí, este item quedará pendiente después de la entrega
                            return true;
                          });

                          // Si no quedarán items pendientes, es la entrega final (facturar)
                          const esEntregaFinal = itemsQueQuedaranPendientes.length === 0;

                          return esEntregaFinal ? 'Facturar Pedido' : 'Registrar Entrega Parcial';
                        })()
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Ítems Entregados */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Ítems Entregados
                </h3>
                {selectedPedido.items.filter(item => item.estadoItem === 'Entregado').length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay ítems entregados aún.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedPedido.items.map((item, index) => (
                          item.estadoItem === 'Entregado' && (
                            <tr key={index}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{item.nombre}</p>
                                <p className="text-sm text-gray-600">Ref: {item.referencia} | Talla: {item.talla}</p>
                              </td>
                              <td className="px-4 py-3 text-center">{item.cantidad}</td>
                              <td className="px-4 py-3 text-right font-medium">
                                ${item.subtotal?.toLocaleString('es-CO')}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <select
                                  value={item.estadoItem}
                                  onChange={(e) => handleUpdateItemEstado(index, e.target.value)}
                                  disabled={loading}
                                  className={`px-3 py-1 rounded text-xs border ${
                                    item.estadoItem === 'En Producción'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : item.estadoItem === 'Listo para Entrega'
                                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                        : 'bg-green-100 text-green-800 border-green-200'
                                  } focus:outline-none focus:ring-1 focus:ring-primary`}
                                >
                                  <option value="En Producción">En Producción</option>
                                  <option value="Listo para Entrega">Listo para Entrega</option>
                                  <option value="Entregado">Entregado</option>
                                </select>
                              </td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sección de Abonos Adicionales */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Registrar Abono Adicional
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Usa esta sección para registrar abonos cuando el cliente paga sin que haya productos listos para entregar.
                </p>

                <form onSubmit={handleRegistrarAbonoAdicional} className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto del Abono <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={abonoAdicionalMonto}
                        onChange={(e) => setAbonoAdicionalMonto(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Método de Pago
                      </label>
                      <select
                        value={abonoAdicionalMetodo}
                        onChange={(e) => setAbonoAdicionalMetodo(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Nequi">Nequi</option>
                        <option value="Daviplata">Daviplata</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Tarjeta">Tarjeta</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{ backgroundColor: '#D50565' }}
                    className="w-full px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Procesando...' : 'Registrar Abono'}
                  </button>
                </form>

                {/* Historial de Abonos */}
                {selectedPedido.abonos && selectedPedido.abonos.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Historial de Abonos</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Método</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedPedido.abonos.map((abono, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 text-gray-700">
                                {new Date(abono.fecha).toLocaleDateString('es-CO', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700">{abono.metodoPago}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-800">
                                ${abono.monto.toLocaleString('es-CO')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {reciboDatos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Pedido Generado</h2>
              <button
                onClick={() => setReciboDatos(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Receipt Preview (80mm width ≈ 300px) */}
            <div id="receipt-print" className="bg-white" style={{ maxWidth: '300px', margin: '0 auto', padding: '8px' }}>
              {/* Company Info */}
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg">{companyConfig?.nombre || 'MARTHA ROMERO UNIFORMES'}</h3>
                {companyConfig?.nit && <p className="text-xs">NIT: {companyConfig.nit}</p>}
                {companyConfig?.direccion && <p className="text-xs">{companyConfig.direccion}</p>}
                {companyConfig?.telefono && <p className="text-xs">Tel: {companyConfig.telefono}</p>}
                <p className="font-bold text-sm mt-2" style={{ letterSpacing: '1px' }}>PEDIDO</p>
              </div>

              {/* Order Info */}
              <div className="border-t border-b border-dashed py-2 mb-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Pedido N°:</span>
                  <span>{String(reciboDatos.numeroPedido).padStart(4, '0')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Fecha:</span>
                  <span>{reciboDatos.fecha}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Cliente:</span>
                  <span>{reciboDatos.clienteNombre}</span>
                </div>
                {reciboDatos.colegioNombre && (
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Colegio:</span>
                    <span>{reciboDatos.colegioNombre}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="border-t border-b border-dashed py-2 mb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Producto</th>
                      <th className="text-center">Cant</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reciboDatos.items.map((item, index) => (
                      <tr key={index}>
                        <td className="py-1">
                          <div className="font-medium">{item.nombre}</div>
                          <div className="text-gray-600 text-[10px]">
                            Ref: {item.referencia} | Talla: {item.talla}
                          </div>
                        </td>
                        <td className="text-center">{item.cantidad}</td>
                        <td className="text-right">${item.subtotal.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-2">
                <div className="flex justify-between font-bold">
                  <span>TOTAL:</span>
                  <span>${reciboDatos.total.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Abono:</span>
                  <span>${reciboDatos.abono.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>SALDO:</span>
                  <span>${reciboDatos.saldo.toLocaleString('es-CO')}</span>
                </div>
              </div>

              {/* Observaciones */}
              {reciboDatos.observaciones && reciboDatos.observaciones.trim() && (
                <div className="border-t border-dashed pt-2 mb-2 text-xs">
                  <p className="font-bold mb-1">Observaciones:</p>
                  <p>{reciboDatos.observaciones}</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center mt-4 text-xs border-t pt-2">
                <p>¡Gracias por su pedido!</p>
                <p>Este es un comprobante de pedido</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 px-4 py-2 text-white rounded-md hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#EA5C2E' }}
                >
                  🖨️ Imprimir
                </button>
                <button
                  onClick={handleOpenEmailModal}
                  className="flex-1 px-4 py-2 text-white rounded-md hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#D50565' }}
                >
                  📧 Enviar por Correo
                </button>
              </div>
              <button
                onClick={() => setReciboDatos(null)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Enviar Pedido por Correo</h2>

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

      {/* MODAL DE CREACIÓN DE CLIENTE */}
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
                    {allColegios.map(colegio => (
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
    </div>
  );
};

export default Pedidos;
