import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

const Clients = () => {
  // Obtener rol del usuario
  const { isAdmin } = useAuth();

  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [colegios, setColegios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const clientesPorPagina = 10;

  // Estado para selección masiva
  const [selectedClients, setSelectedClients] = useState([]);

  // Estados para pestañas
  const [activeTab, setActiveTab] = useState('lista'); // 'lista' | 'buscador'

  // Estados para buscador de cliente
  const [searchClienteTerm, setSearchClienteTerm] = useState('');
  const [searchClienteResults, setSearchClienteResults] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialCliente, setHistorialCliente] = useState({
    facturas: [],
    pedidos: [],
    apartados: []
  });

  // Estado del formulario
  const [formData, setFormData] = useState({
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

  // Abreviaturas para tipos de documento
  const abreviaturaDocumento = {
    'Cédula de Ciudadanía': 'CC',
    'NIT': 'NIT',
    'Cédula de Extranjería': 'CE',
    'Tarjeta de Identidad': 'TI'
  };

  // Cargar clientes y colegios al montar el componente
  useEffect(() => {
    fetchClients();
    fetchColegios();
  }, []);

  // Obtener todos los colegios
  const fetchColegios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'colegios'));
      const colegiosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setColegios(colegiosData);
    } catch (error) {
      console.error('Error al cargar colegios:', error);
    }
  };

  // Filtrar clientes cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client =>
        client.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.numeroDocumento.includes(searchTerm)
      );
      setFilteredClients(filtered);
    }
    // Reiniciar a la página 1 y limpiar selección cuando cambia la búsqueda
    setPaginaActual(1);
    setSelectedClients([]);
  }, [searchTerm, clients]);

  // Obtener todos los clientes
  const fetchClients = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'clients'));
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClients(clientsData);
      setFilteredClients(clientsData);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      alert('Error al cargar los clientes.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal para crear cliente
  const handleOpenModal = () => {
    setEditingClient(null);
    setFormData({
      nombreCompleto: '',
      tipoDocumento: 'Cédula de Ciudadanía',
      numeroDocumento: '',
      telefono: '',
      email: '',
      direccion: '',
      ciudad: '',
      colegioId: ''
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar cliente
  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      nombreCompleto: client.nombreCompleto,
      tipoDocumento: client.tipoDocumento,
      numeroDocumento: client.numeroDocumento,
      telefono: client.telefono,
      email: client.email || '',
      direccion: client.direccion || '',
      ciudad: client.ciudad || '',
      colegioId: client.colegioId || ''
    });
    setIsModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({
      nombreCompleto: '',
      tipoDocumento: 'Cédula de Ciudadanía',
      numeroDocumento: '',
      telefono: '',
      email: '',
      direccion: '',
      ciudad: '',
      colegioId: ''
    });
  };

  // Verificar si el número de documento ya existe (solo al crear)
  const checkDocumentoExists = async (numeroDocumento) => {
    const q = query(collection(db, 'clients'), where('numeroDocumento', '==', numeroDocumento));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  // Guardar cliente (crear o actualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.nombreCompleto.trim() || !formData.numeroDocumento.trim()) {
      alert('Por favor, completa todos los campos obligatorios.');
      return;
    }

    setLoading(true);
    try {
      if (editingClient) {
        // Actualizar cliente existente
        const clientRef = doc(db, 'clients', editingClient.id);
        await updateDoc(clientRef, {
          nombreCompleto: formData.nombreCompleto.trim(),
          tipoDocumento: formData.tipoDocumento,
          numeroDocumento: formData.numeroDocumento.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim(),
          direccion: formData.direccion.trim(),
          ciudad: formData.ciudad.trim(),
          colegioId: formData.colegioId || null
        });
        alert('Cliente actualizado correctamente.');
      } else {
        // Verificar si el número de documento ya existe
        const exists = await checkDocumentoExists(formData.numeroDocumento.trim());
        if (exists) {
          alert('Ya existe un cliente con este número de documento. Por favor, usa un número único.');
          setLoading(false);
          return;
        }

        // Crear nuevo cliente
        await addDoc(collection(db, 'clients'), {
          nombreCompleto: formData.nombreCompleto.trim(),
          tipoDocumento: formData.tipoDocumento,
          numeroDocumento: formData.numeroDocumento.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim(),
          direccion: formData.direccion.trim(),
          ciudad: formData.ciudad.trim(),
          colegioId: formData.colegioId || null
        });
        alert('Cliente guardado correctamente.');
      }

      handleCloseModal();
      fetchClients();
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      alert('Error al guardar el cliente.');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar cliente
  const handleDelete = async (id, nombre) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar al cliente "${nombre}"?`
    );

    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'clients', id));
      alert('Cliente eliminado correctamente.');
      fetchClients();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      alert('Error al eliminar el cliente.');
    } finally {
      setLoading(false);
    }
  };

  // ===== FUNCIONES PARA BUSCADOR DE CLIENTE =====

  // Buscar clientes en tiempo real
  useEffect(() => {
    if (!searchClienteTerm.trim()) {
      setSearchClienteResults([]);
      return;
    }

    const searchLower = searchClienteTerm.toLowerCase();
    const filtered = clients.filter(client =>
      client.nombreCompleto.toLowerCase().includes(searchLower) ||
      client.numeroDocumento.includes(searchClienteTerm)
    );
    setSearchClienteResults(filtered);
  }, [searchClienteTerm, clients]);

  // Seleccionar cliente y cargar su historial
  const handleSelectCliente = async (cliente) => {
    setSelectedCliente(cliente);
    setSearchClienteTerm('');
    setSearchClienteResults([]);
    await cargarHistorialCliente(cliente);
  };

  // Cargar historial completo del cliente
  const cargarHistorialCliente = async (cliente) => {
    setLoadingHistorial(true);
    try {
      // 1. Cargar facturas (sales)
      const facturasQuery = query(
        collection(db, 'sales'),
        where('clienteId', '==', cliente.id)
      );
      const facturasSnapshot = await getDocs(facturasQuery);
      const facturas = facturasSnapshot.docs.map(doc => ({
        id: doc.id,
        tipo: 'factura',
        ...doc.data()
      }));

      // 2. Cargar pedidos
      const pedidosQuery = query(
        collection(db, 'pedidos'),
        where('clienteId', '==', cliente.id)
      );
      const pedidosSnapshot = await getDocs(pedidosQuery);
      const pedidos = pedidosSnapshot.docs.map(doc => ({
        id: doc.id,
        tipo: 'pedido',
        ...doc.data()
      }));

      // 3. Cargar apartados
      const apartadosQuery = query(
        collection(db, 'apartados'),
        where('clienteId', '==', cliente.id)
      );
      const apartadosSnapshot = await getDocs(apartadosQuery);
      const apartados = apartadosSnapshot.docs.map(doc => ({
        id: doc.id,
        tipo: 'apartado',
        ...doc.data()
      }));

      // Ordenar por fecha (más reciente primero)
      facturas.sort((a, b) => {
        const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return fechaB - fechaA;
      });

      pedidos.sort((a, b) => {
        const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return fechaB - fechaA;
      });

      apartados.sort((a, b) => {
        const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return fechaB - fechaA;
      });

      setHistorialCliente({
        facturas,
        pedidos,
        apartados
      });
    } catch (error) {
      console.error('Error al cargar historial del cliente:', error);
      alert('Error al cargar el historial del cliente.');
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Limpiar selección de cliente
  const handleLimpiarCliente = () => {
    setSelectedCliente(null);
    setHistorialCliente({
      facturas: [],
      pedidos: [],
      apartados: []
    });
    setSearchClienteTerm('');
    setSearchClienteResults([]);
  };

  // Formatear precio como moneda
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price);
  };

  // ===== FIN FUNCIONES BUSCADOR =====

  // Activar input de archivo
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Función auxiliar para procesar el campo NIT/CC y separar tipo y número
  const procesarDocumento = (valorOriginal) => {
    // Convertir a string, minúsculas y limpiar espacios extra
    const valor = String(valorOriginal || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Reemplazar múltiples espacios por uno solo

    let tipoDocumento = 'Cédula de Ciudadanía'; // Por defecto
    let numeroDocumento = valor;

    // Identificar prefijos y separar
    if (valor.startsWith('cc cc ')) {
      tipoDocumento = 'Cédula de Ciudadanía';
      numeroDocumento = valor.substring(6).trim(); // Quitar "cc cc "
    } else if (valor.startsWith('cc ')) {
      tipoDocumento = 'Cédula de Ciudadanía';
      numeroDocumento = valor.substring(3).trim(); // Quitar "cc "
    } else if (valor.startsWith('nit ')) {
      tipoDocumento = 'NIT';
      numeroDocumento = valor.substring(4).trim(); // Quitar "nit "
    } else if (valor.startsWith('ti ')) {
      tipoDocumento = 'Tarjeta de Identidad';
      numeroDocumento = valor.substring(3).trim(); // Quitar "ti "
    } else if (valor.startsWith('c.e ')) {
      tipoDocumento = 'Cédula de Extranjería';
      numeroDocumento = valor.substring(4).trim(); // Quitar "c.e "
    } else if (valor.startsWith('ce ')) {
      tipoDocumento = 'Cédula de Extranjería';
      numeroDocumento = valor.substring(3).trim(); // Quitar "ce "
    }
    // Si no encuentra prefijo, usa el valor completo como numeroDocumento
    // y mantiene tipoDocumento como "Cédula de Ciudadanía"

    return { tipoDocumento, numeroDocumento };
  };

  // Importación masiva desde Excel
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar extensión
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
      alert('Por favor, selecciona un archivo .xlsx o .csv');
      return;
    }

    setLoading(true);

    try {
      // Leer el archivo Excel
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('El archivo está vacío o no tiene el formato correcto.');
        setLoading(false);
        return;
      }

      // Obtener todos los números de documento existentes
      const existingClientsSnapshot = await getDocs(collection(db, 'clients'));
      const existingDocuments = new Set();
      existingClientsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.numeroDocumento) {
          existingDocuments.add(String(data.numeroDocumento));
        }
      });

      // Preparar batch y contadores
      const batch = writeBatch(db);
      let nuevosClientes = 0;
      let clientesOmitidos = 0;

      // Procesar cada fila del Excel
      jsonData.forEach((row) => {
        // Procesar la columna NIT/CC para separar tipo y número
        const documentoInfo = procesarDocumento(row['NIT/CC']);
        const { tipoDocumento, numeroDocumento } = documentoInfo;

        // Validar que tenga al menos número de documento y nombre
        if (!numeroDocumento || !row['CLIENTE']) {
          clientesOmitidos++;
          return;
        }

        // Verificar si ya existe (usando el número limpio)
        if (existingDocuments.has(numeroDocumento)) {
          clientesOmitidos++;
          return;
        }

        // Añadir al Set para evitar duplicados en el mismo archivo
        existingDocuments.add(numeroDocumento);

        // Crear el documento del cliente
        const newClientRef = doc(collection(db, 'clients'));
        batch.set(newClientRef, {
          nombreCompleto: String(row['CLIENTE'] || '').trim(),
          tipoDocumento: tipoDocumento,
          numeroDocumento: numeroDocumento,
          telefono: String(row['TELEFONO'] || '').trim(),
          email: String(row['E-MAIL'] || '').trim(),
          direccion: String(row['DIRECCION'] || '').trim(),
          ciudad: String(row['CIUDAD'] || '').trim()
        });

        nuevosClientes++;
      });

      // Ejecutar el batch
      if (nuevosClientes > 0) {
        await batch.commit();
      }

      // Recargar la lista de clientes
      await fetchClients();

      // Mostrar resultado
      alert(`Importación completada: ${nuevosClientes} clientes nuevos añadidos, ${clientesOmitidos} clientes omitidos por duplicados.`);

      // Limpiar el input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error al importar clientes:', error);
      alert('Error al importar el archivo. Verifica el formato y los datos.');
    } finally {
      setLoading(false);
    }
  };

  // Calcular paginación
  const totalPaginas = Math.ceil(filteredClients.length / clientesPorPagina);
  const indiceInicio = (paginaActual - 1) * clientesPorPagina;
  const indiceFin = indiceInicio + clientesPorPagina;
  const clientesPaginaActual = filteredClients.slice(indiceInicio, indiceFin);

  // Funciones de navegación de páginas
  const irPaginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual(paginaActual + 1);
      setSelectedClients([]); // Limpiar selección al cambiar de página
    }
  };

  const irPaginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(paginaActual - 1);
      setSelectedClients([]); // Limpiar selección al cambiar de página
    }
  };

  // Funciones de selección masiva
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Seleccionar todos los clientes de la página actual
      const idsEnPaginaActual = clientesPaginaActual.map(client => client.id);
      setSelectedClients(idsEnPaginaActual);
    } else {
      // Deseleccionar todos
      setSelectedClients([]);
    }
  };

  const handleSelectClient = (clientId) => {
    if (selectedClients.includes(clientId)) {
      // Deseleccionar
      setSelectedClients(selectedClients.filter(id => id !== clientId));
    } else {
      // Seleccionar
      setSelectedClients([...selectedClients, clientId]);
    }
  };

  // Verificar si todos los clientes de la página actual están seleccionados
  const todosSeleccionados = clientesPaginaActual.length > 0 &&
    clientesPaginaActual.every(client => selectedClients.includes(client.id));

  // Eliminar clientes seleccionados
  const handleDeleteSelected = async () => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar ${selectedClients.length} cliente(s)?`
    );

    if (!confirmDelete) return;

    setLoading(true);
    try {
      // Usar writeBatch para eliminar múltiples documentos
      const batch = writeBatch(db);

      selectedClients.forEach((clientId) => {
        const clientRef = doc(db, 'clients', clientId);
        batch.delete(clientRef);
      });

      await batch.commit();

      alert(`${selectedClients.length} cliente(s) eliminado(s) correctamente.`);

      // Limpiar selección y recargar
      setSelectedClients([]);
      fetchClients();
    } catch (error) {
      console.error('Error al eliminar clientes:', error);
      alert('Error al eliminar los clientes seleccionados.');
    } finally {
      setLoading(false);
    }
  };

  // Crear un mapa de colegios para mostrar los nombres en la tabla
  const colegioMap = useMemo(() => {
    if (!colegios || colegios.length === 0) {
      return {};
    }
    return colegios.reduce((acc, colegio) => {
      acc[colegio.id] = colegio.nombre;
      return acc;
    }, {});
  }, [colegios]);

  return (
    <div className="max-w-7xl">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-600 mt-1">Gestión de clientes</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {isAdmin && selectedClients.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={loading}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Eliminar ({selectedClients.length}) seleccionados</span>
              <span className="sm:hidden">Eliminar ({selectedClients.length})</span>
            </button>
          )}
          <button
            onClick={handleImportClick}
            disabled={loading}
            style={{ backgroundColor: '#EA5C2E' }}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="hidden sm:inline">Importar Clientes</span>
            <span className="sm:hidden">Importar</span>
          </button>
          <button
            onClick={handleOpenModal}
            style={{ backgroundColor: '#D50565' }}
            className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <span className="hidden sm:inline">+ Añadir Nuevo Cliente</span>
            <span className="sm:hidden">+ Añadir</span>
          </button>
        </div>
      </div>

      {/* Input file oculto para importar Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFileImport}
        style={{ display: 'none' }}
      />

      {/* Pestañas */}
      <div className="bg-white rounded-lg shadow-md mb-4">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('lista')}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'lista'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            👥 Lista de Clientes
          </button>
          <button
            onClick={() => setActiveTab('buscador')}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'buscador'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            🔍 Buscador de Cliente
          </button>
        </div>
      </div>

      {/* CONTENIDO TAB: LISTA DE CLIENTES */}
      {activeTab === 'lista' && (
        <>
          {/* Campo de Búsqueda */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar por nombre o número de documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Tabla de Clientes */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {loading && clients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Cargando clientes...</div>
            ) : filteredClients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchTerm ? 'No se encontraron clientes con ese criterio de búsqueda.' : 'No hay clientes registrados. Añade uno nuevo usando el botón de arriba.'}
              </div>
            ) : (
              <>
            {/* Vista de Tarjetas - Solo Móvil */}
            <div className="md:hidden space-y-4">
              {clientesPaginaActual.map((client) => (
                <div key={client.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  {/* Header de la tarjeta con checkbox (solo admin) */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(client.id)}
                            onChange={() => handleSelectClient(client.id)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                          />
                        )}
                        <h3 className="font-semibold text-gray-900">{client.nombreCompleto}</h3>
                      </div>
                      <p className="text-sm text-gray-500">
                        {abreviaturaDocumento[client.tipoDocumento]} {client.numeroDocumento}
                      </p>
                    </div>
                  </div>

                  {/* Información del cliente */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Teléfono:</span>
                      <p className="font-medium text-gray-900">{client.telefono || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Ciudad:</span>
                      <p className="font-medium text-gray-900">{client.ciudad || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Colegio:</span>
                      <p className="font-medium text-gray-900">
                        {client.colegioId ? (colegioMap[client.colegioId] || 'Colegio no encontrado') : '-'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Email:</span>
                      <p className="font-medium text-gray-900 break-all">{client.email || '-'}</p>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(client)}
                      disabled={loading}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      Editar
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(client.id, client.nombreCompleto)}
                        disabled={loading}
                        className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Vista de Tabla - Solo Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre Completo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teléfono
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ciudad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Colegio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clientesPaginaActual.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    {isAdmin && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          onChange={() => handleSelectClient(client.id)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {client.nombreCompleto}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {abreviaturaDocumento[client.tipoDocumento]} {client.numeroDocumento}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {client.telefono}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {client.ciudad || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {client.colegioId ? (colegioMap[client.colegioId] || 'Colegio no encontrado') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {client.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(client)}
                        disabled={loading}
                        className="px-4 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                      >
                        Editar
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(client.id, client.nombreCompleto)}
                          disabled={loading}
                          className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

          {/* Controles de Paginación */}
          {filteredClients.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between bg-white px-4 sm:px-6 py-3 rounded-lg shadow-md gap-3">
              <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                <span className="hidden sm:inline">
                  Mostrando{' '}
                  <span className="font-medium">{indiceInicio + 1}</span>
                  {' '}-{' '}
                  <span className="font-medium">
                    {Math.min(indiceFin, filteredClients.length)}
                  </span>
                  {' '}de{' '}
                  <span className="font-medium">{filteredClients.length}</span>
                  {' '}clientes
                </span>
                <span className="sm:hidden">
                  {indiceInicio + 1}-{Math.min(indiceFin, filteredClients.length)} de {filteredClients.length}
                </span>
              </div>

              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="text-xs sm:text-sm text-gray-700">
                  Pág. <span className="font-medium">{paginaActual}</span> de{' '}
                  <span className="font-medium">{totalPaginas}</span>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={irPaginaAnterior}
                    disabled={paginaActual === 1}
                    className="px-3 sm:px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-200"
                  >
                    <span className="hidden sm:inline">Anterior</span>
                    <span className="sm:hidden">&larr;</span>
                  </button>
                  <button
                    onClick={irPaginaSiguiente}
                    disabled={paginaActual === totalPaginas}
                    className="px-3 sm:px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-200"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <span className="sm:hidden">&rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CONTENIDO TAB: BUSCADOR DE CLIENTE */}
      {activeTab === 'buscador' && (
        <div className="space-y-4">
          {/* Buscador */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Buscar Cliente</h3>

            {!selectedCliente ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    value={searchClienteTerm}
                    onChange={(e) => setSearchClienteTerm(e.target.value)}
                    placeholder="Buscar por nombre o número de documento..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Resultados de búsqueda */}
                {searchClienteResults.length > 0 && (
                  <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    {searchClienteResults.map((cliente) => (
                      <div
                        key={cliente.id}
                        onClick={() => handleSelectCliente(cliente)}
                        className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{cliente.nombreCompleto}</p>
                            <p className="text-sm text-gray-600">
                              {abreviaturaDocumento[cliente.tipoDocumento] || cliente.tipoDocumento}: {cliente.numeroDocumento}
                            </p>
                            {cliente.telefono && (
                              <p className="text-sm text-gray-500">📞 {cliente.telefono}</p>
                            )}
                          </div>
                          <button className="text-primary font-medium text-sm hover:underline">
                            Ver historial →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchClienteTerm && searchClienteResults.length === 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center text-gray-600">
                    No se encontraron clientes con ese criterio de búsqueda.
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Cliente seleccionado */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{selectedCliente.nombreCompleto}</h4>
                      <p className="text-gray-700 mt-1">
                        {abreviaturaDocumento[selectedCliente.tipoDocumento] || selectedCliente.tipoDocumento}: {selectedCliente.numeroDocumento}
                      </p>
                      {selectedCliente.telefono && (
                        <p className="text-gray-600 mt-1">📞 {selectedCliente.telefono}</p>
                      )}
                      {selectedCliente.email && (
                        <p className="text-gray-600">📧 {selectedCliente.email}</p>
                      )}
                      {selectedCliente.ciudad && (
                        <p className="text-gray-600">📍 {selectedCliente.ciudad}</p>
                      )}
                    </div>
                    <button
                      onClick={handleLimpiarCliente}
                      className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Buscar otro cliente
                    </button>
                  </div>
                </div>

                {/* Historial del cliente */}
                {loadingHistorial ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <p className="text-gray-600">Cargando historial...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Resumen */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600 mb-1">Facturas (Ventas)</p>
                        <p className="text-2xl font-bold text-green-700">{historialCliente.facturas.length}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Total: {formatPrice(historialCliente.facturas.reduce((sum, f) => sum + (f.total || 0), 0))}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-600 mb-1">Pedidos</p>
                        <p className="text-2xl font-bold text-blue-700">{historialCliente.pedidos.length}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Total: {formatPrice(historialCliente.pedidos.reduce((sum, p) => sum + (p.totalPedido || 0), 0))}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <p className="text-sm text-gray-600 mb-1">Apartados</p>
                        <p className="text-2xl font-bold text-purple-700">{historialCliente.apartados.length}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Total: {formatPrice(historialCliente.apartados.reduce((sum, a) => sum + (a.total || 0), 0))}
                        </p>
                      </div>
                    </div>

                    {/* Facturas */}
                    {historialCliente.facturas.length > 0 && (
                      <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="bg-green-600 text-white px-4 py-3">
                          <h4 className="font-semibold">💳 Facturas ({historialCliente.facturas.length})</h4>
                        </div>
                        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                          {historialCliente.facturas.map((factura) => {
                            const fecha = factura.createdAt?.toDate ? factura.createdAt.toDate() : new Date(factura.createdAt || 0);
                            return (
                              <div key={factura.id} className="p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      Factura #{factura.numeroFactura || factura.id}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {fecha.toLocaleDateString('es-CO', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {factura.items?.length || 0} producto(s)
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-green-600">
                                      {formatPrice(factura.total || 0)}
                                    </p>
                                    <p className="text-xs text-gray-500">{factura.metodoPago}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pedidos */}
                    {historialCliente.pedidos.length > 0 && (
                      <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="bg-blue-600 text-white px-4 py-3">
                          <h4 className="font-semibold">📦 Pedidos ({historialCliente.pedidos.length})</h4>
                        </div>
                        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                          {historialCliente.pedidos.map((pedido) => {
                            const fecha = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date(pedido.createdAt || 0);
                            return (
                              <div key={pedido.id} className="p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      Pedido #{String(pedido.numeroPedido).padStart(4, '0')}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {fecha.toLocaleDateString('es-CO', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {pedido.items?.length || 0} producto(s) • Estado: {pedido.estadoGeneral}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-blue-600">
                                      {formatPrice(pedido.totalPedido || 0)}
                                    </p>
                                    {pedido.fechaEntrega && (
                                      <p className="text-xs text-gray-500">
                                        Entrega: {new Date(pedido.fechaEntrega).toLocaleDateString('es-CO')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Apartados */}
                    {historialCliente.apartados.length > 0 && (
                      <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="bg-purple-600 text-white px-4 py-3">
                          <h4 className="font-semibold">🏦 Apartados ({historialCliente.apartados.length})</h4>
                        </div>
                        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                          {historialCliente.apartados.map((apartado) => {
                            const fecha = apartado.createdAt?.toDate ? apartado.createdAt.toDate() : new Date(apartado.createdAt || 0);
                            return (
                              <div key={apartado.id} className="p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      Apartado #{String(apartado.numeroApartado).padStart(4, '0')}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {fecha.toLocaleDateString('es-CO', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {apartado.items?.length || 0} producto(s) • Estado: {apartado.estadoGeneral}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-purple-600">
                                      {formatPrice(apartado.total || 0)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Abonado: {formatPrice(apartado.totalAbonado || 0)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Saldo: {formatPrice((apartado.total || 0) - (apartado.totalAbonado || 0))}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sin historial */}
                    {historialCliente.facturas.length === 0 &&
                     historialCliente.pedidos.length === 0 &&
                     historialCliente.apartados.length === 0 && (
                      <div className="bg-white rounded-lg shadow-md p-8 text-center">
                        <p className="text-gray-600">Este cliente no tiene historial de compras registrado.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                {editingClient ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre Completo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombreCompleto}
                    onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
                    placeholder="Ej: Juan Pérez García"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Tipo de Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.tipoDocumento}
                    onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
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
                    value={formData.numeroDocumento}
                    onChange={(e) => setFormData({ ...formData, numeroDocumento: e.target.value })}
                    placeholder="Ej: 123456789"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Ej: 3001234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Ej: cliente@ejemplo.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                {/* Dirección */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    placeholder="Ej: Calle 123 # 45-67"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    placeholder="Ej: Bogotá"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                {/* Colegio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colegio (Opcional)
                  </label>
                  <select
                    value={formData.colegioId}
                    onChange={(e) => setFormData({ ...formData, colegioId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
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

              <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : 'Guardar Cliente'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
