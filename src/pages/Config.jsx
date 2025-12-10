import { useState, useEffect } from 'react';
import { db, functions, storage } from '../services/firebase';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  getDoc, setDoc, serverTimestamp, query, where, orderBy
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ref, uploadBytesResumable, getDownloadURL
} from 'firebase/storage';
import GestionCostos from '../components/config/GestionCostos';

const Config = () => {
  const [activeTab, setActiveTab] = useState('colegios');

  // Estados para Gestión de Colegios
  const [colegios, setColegios] = useState([]);
  const [formData, setFormData] = useState({ nombre: '', codigo: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estados para Gestión de Satélites
  const [satelites, setSatelites] = useState([]);
  const [formDataSatelite, setFormDataSatelite] = useState({
    nombre: '',
    codigo: '',
    telefono: '',
    direccion: '',
    cedula: ''
  });
  const [editingIdSatelite, setEditingIdSatelite] = useState(null);
  const [loadingSatelite, setLoadingSatelite] = useState(false);

  // Estados para Gestión de Proveedores
  const [proveedores, setProveedores] = useState([]);
  const [formDataProveedor, setFormDataProveedor] = useState({ nombre: '', nit: '', telefono: '' });
  const [editingIdProveedor, setEditingIdProveedor] = useState(null);
  const [loadingProveedor, setLoadingProveedor] = useState(false);

  // Estados para Datos de la Empresa
  const [formDataEmpresa, setFormDataEmpresa] = useState({
    nombre: '',
    nit: '',
    direccion: '',
    telefono: '',
    pieDeFactura: '' // Opcional: para el pie de la tirilla
  });
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);
  const [logoUrl, setLogoUrl] = useState(''); // Para mostrar el logo actual
  const [logoFile, setLogoFile] = useState(null); // Para el archivo nuevo
  const [uploadProgress, setUploadProgress] = useState(0); // Para la barra de progreso

  // Estados para Gestión de Usuarios
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    role: 'vendedor', // Por defecto es 'vendedor'
  });

  // Estados para Gestión de Clientes B2B
  const [clientesB2B, setClientesB2B] = useState([]);
  const [loadingB2B, setLoadingB2B] = useState(false);
  const [showB2BModal, setShowB2BModal] = useState(false);
  const [editingB2BId, setEditingB2BId] = useState(null);
  const [formDataB2B, setFormDataB2B] = useState({
    nombre: '',
    codigoColegio: '',
    email: '',
    password: '',
    contactoNombre: '',
    contactoTelefono: '',
    activo: true
  });

  // Estados para Gestión de Pedidos B2B
  const [pedidosB2B, setPedidosB2B] = useState([]);
  const [loadingPedidosB2B, setLoadingPedidosB2B] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showPedidoModal, setShowPedidoModal] = useState(false);
  const [stockInfo, setStockInfo] = useState({}); // {productoId: stockDisponible}

  // Cargar datos según la pestaña activa
  useEffect(() => {
    if (activeTab === 'colegios') {
      fetchColegios();
    } else if (activeTab === 'satelites') {
      fetchSatelites();
    } else if (activeTab === 'proveedores') {
      fetchProveedores();
    } else if (activeTab === 'empresa') {
      fetchDatosEmpresa();
    } else if (activeTab === 'usuarios') {
      fetchUsuarios();
    } else if (activeTab === 'clientesB2B') {
      fetchClientesB2B();
    } else if (activeTab === 'pedidosB2B') {
      fetchPedidosB2B();
    }
  }, [activeTab]);

  // Leer: Obtener todos los colegios de Firestore
  const fetchColegios = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'colegios'));
      const colegiosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setColegios(colegiosData);
    } catch (error) {
      console.error('Error al cargar colegios:', error);
      alert('Error al cargar los colegios. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Crear o Actualizar: Guardar colegio en Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim() || !formData.codigo.trim()) {
      alert('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Actualizar colegio existente
        const colegioRef = doc(db, 'colegios', editingId);
        await updateDoc(colegioRef, {
          nombre: formData.nombre.trim(),
          codigo: formData.codigo.trim().toUpperCase()
        });
        alert('Colegio actualizado correctamente.');
      } else {
        // Crear nuevo colegio
        await addDoc(collection(db, 'colegios'), {
          nombre: formData.nombre.trim(),
          codigo: formData.codigo.trim().toUpperCase()
        });
        alert('Colegio guardado correctamente.');
      }

      // Limpiar formulario y recargar datos
      setFormData({ nombre: '', codigo: '' });
      setEditingId(null);
      fetchColegios();
    } catch (error) {
      console.error('Error al guardar colegio:', error);
      alert('Error al guardar el colegio. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Editar: Cargar datos del colegio en el formulario
  const handleEdit = (colegio) => {
    setFormData({ nombre: colegio.nombre, codigo: colegio.codigo });
    setEditingId(colegio.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Eliminar: Borrar colegio de Firestore
  const handleDelete = async (id, nombre) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar el colegio "${nombre}"?`
    );

    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'colegios', id));
      alert('Colegio eliminado correctamente.');
      fetchColegios();
    } catch (error) {
      console.error('Error al eliminar colegio:', error);
      alert('Error al eliminar el colegio. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar edición
  const handleCancel = () => {
    setFormData({ nombre: '', codigo: '' });
    setEditingId(null);
  };

  // ============================================
  // FUNCIONES CRUD PARA SATÉLITES
  // ============================================

  // Leer: Obtener todos los satélites de Firestore
  const fetchSatelites = async () => {
    setLoadingSatelite(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'satelites'));
      const satelitesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSatelites(satelitesData);
    } catch (error) {
      console.error('Error al cargar satélites:', error);
      alert('Error al cargar los satélites. Por favor, intenta de nuevo.');
    } finally {
      setLoadingSatelite(false);
    }
  };

  // Crear o Actualizar: Guardar satélite en Firestore
  const handleSubmitSatelite = async (e) => {
    e.preventDefault();

    if (!formDataSatelite.nombre.trim()) {
      alert('Por favor, completa el nombre del satélite.');
      return;
    }

    setLoadingSatelite(true);
    try {
      const sateliteData = {
        nombre: formDataSatelite.nombre.trim(),
        codigo: formDataSatelite.codigo.trim().toUpperCase(),
        telefono: formDataSatelite.telefono.trim(),
        direccion: formDataSatelite.direccion.trim(),
        cedula: formDataSatelite.cedula.trim()
      };

      if (editingIdSatelite) {
        // Actualizar satélite existente
        const sateliteRef = doc(db, 'satelites', editingIdSatelite);
        await updateDoc(sateliteRef, sateliteData);
        alert('Satélite actualizado correctamente.');
      } else {
        // Crear nuevo satélite
        await addDoc(collection(db, 'satelites'), sateliteData);
        alert('Satélite guardado correctamente.');
      }

      // Limpiar formulario y recargar datos
      setFormDataSatelite({
        nombre: '',
        codigo: '',
        telefono: '',
        direccion: '',
        cedula: ''
      });
      setEditingIdSatelite(null);
      fetchSatelites();
    } catch (error) {
      console.error('Error al guardar satélite:', error);
      alert('Error al guardar el satélite. Por favor, intenta de nuevo.');
    } finally {
      setLoadingSatelite(false);
    }
  };

  // Editar: Cargar datos del satélite en el formulario
  const handleEditSatelite = (satelite) => {
    setFormDataSatelite({
      nombre: satelite.nombre,
      codigo: satelite.codigo,
      telefono: satelite.telefono || '',
      direccion: satelite.direccion || '',
      cedula: satelite.cedula || ''
    });
    setEditingIdSatelite(satelite.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Eliminar: Borrar satélite de Firestore
  const handleDeleteSatelite = async (id, nombre) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar el satélite "${nombre}"?`
    );

    if (!confirmDelete) return;

    setLoadingSatelite(true);
    try {
      await deleteDoc(doc(db, 'satelites', id));
      alert('Satélite eliminado correctamente.');
      fetchSatelites();
    } catch (error) {
      console.error('Error al eliminar satélite:', error);
      alert('Error al eliminar el satélite. Por favor, intenta de nuevo.');
    } finally {
      setLoadingSatelite(false);
    }
  };

  // Cancelar edición de satélite
  const handleCancelSatelite = () => {
    setFormDataSatelite({
      nombre: '',
      codigo: '',
      telefono: '',
      direccion: '',
      cedula: ''
    });
    setEditingIdSatelite(null);
  };

  // ============================================
  // FUNCIONES CRUD PARA PROVEEDORES
  // ============================================

  // Leer: Obtener todos los proveedores de Firestore
  const fetchProveedores = async () => {
    setLoadingProveedor(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'proveedores'));
      const proveedoresData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProveedores(proveedoresData);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      alert('Error al cargar los proveedores. Por favor, intenta de nuevo.');
    } finally {
      setLoadingProveedor(false);
    }
  };

  // Crear o Actualizar: Guardar proveedor en Firestore
  const handleSubmitProveedor = async (e) => {
    e.preventDefault();

    if (!formDataProveedor.nombre.trim() || !formDataProveedor.nit.trim()) {
      alert('Por favor, completa al menos nombre y NIT.');
      return;
    }

    setLoadingProveedor(true);
    try {
      const data = {
        nombre: formDataProveedor.nombre.trim(),
        nit: formDataProveedor.nit.trim(),
        telefono: formDataProveedor.telefono.trim() || '',
      };

      if (editingIdProveedor) {
        // Actualizar proveedor existente
        const proveedorRef = doc(db, 'proveedores', editingIdProveedor);
        await updateDoc(proveedorRef, data);
        alert('Proveedor actualizado correctamente.');
      } else {
        // Crear nuevo proveedor
        await addDoc(collection(db, 'proveedores'), {
          ...data,
          createdAt: serverTimestamp()
        });
        alert('Proveedor guardado correctamente.');
      }

      // Limpiar formulario y recargar datos
      setFormDataProveedor({ nombre: '', nit: '', telefono: '' });
      setEditingIdProveedor(null);
      fetchProveedores();
    } catch (error) {
      console.error('Error al guardar proveedor:', error);
      alert('Error al guardar el proveedor. Por favor, intenta de nuevo.');
    } finally {
      setLoadingProveedor(false);
    }
  };

  // Editar: Cargar datos del proveedor en el formulario
  const handleEditProveedor = (proveedor) => {
    setFormDataProveedor({
      nombre: proveedor.nombre || '',
      nit: proveedor.nit || '',
      telefono: proveedor.telefono || ''
    });
    setEditingIdProveedor(proveedor.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Eliminar: Borrar proveedor de Firestore
  const handleDeleteProveedor = async (id, nombre) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar el proveedor "${nombre}"?`
    );

    if (!confirmDelete) return;

    setLoadingProveedor(true);
    try {
      await deleteDoc(doc(db, 'proveedores', id));
      alert('Proveedor eliminado correctamente.');
      fetchProveedores();
    } catch (error) {
      console.error('Error al eliminar proveedor:', error);
      alert('Error al eliminar el proveedor. Por favor, intenta de nuevo.');
    } finally {
      setLoadingProveedor(false);
    }
  };

  // Cancelar edición de proveedor
  const handleCancelProveedor = () => {
    setFormDataProveedor({ nombre: '', nit: '', telefono: '' });
    setEditingIdProveedor(null);
  };

  // ============================================
  // FUNCIONES PARA DATOS DE LA EMPRESA
  // ============================================

  // Leer: Obtener los datos del documento 'company'
  const fetchDatosEmpresa = async () => {
    setLoadingEmpresa(true);
    try {
      const docRef = doc(db, 'config', 'company'); // Documento único
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setFormDataEmpresa(docSnap.data());
        setLogoUrl(docSnap.data().logoUrl || ''); // Cargar URL del logo
      } else {
        // Si no existe, el formulario estará vacío, listo para ser creado
        console.log("No se encontró el documento de configuración de la empresa.");
      }
    } catch (error) {
      console.error('Error al cargar datos de la empresa:', error);
      alert('Error al cargar los datos de la empresa.');
    } finally {
      setLoadingEmpresa(false);
    }
  };

  // Guardar/Actualizar: Lógica mejorada para subir logo
  const handleSubmitEmpresa = async (e) => {
    e.preventDefault();
    setLoadingEmpresa(true);
    setUploadProgress(0);

    try {
      let finalLogoUrl = logoUrl; // Empezar con la URL que ya teníamos

      // 1. Si hay un archivo NUEVO para subir
      if (logoFile) {
        const storageRef = ref(storage, 'config/logo.png'); // Ruta fija para el logo
        const uploadTask = uploadBytesResumable(storageRef, logoFile);

        // Escuchar el progreso
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            // Manejar error de subida
            console.error("Error al subir el logo:", error);
            throw error; // Detener el proceso
          },
          async () => {
            // Subida completada con éxito
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setLogoUrl(downloadURL); // Actualizar la URL de la imagen
            finalLogoUrl = downloadURL; // Guardar la nueva URL

            // 2. Guardar TODO en Firestore (incluyendo la nueva URL)
            await saveConfigData({ ...formDataEmpresa, logoUrl: finalLogoUrl });
            setLogoFile(null); // Limpiar el archivo
            setUploadProgress(0);
            setLoadingEmpresa(false);
          }
        );
      } else {
        // 2. Si NO hay archivo nuevo, solo guardar los datos de texto
        await saveConfigData({ ...formDataEmpresa, logoUrl: finalLogoUrl });
        setLoadingEmpresa(false);
      }
    } catch (error) {
      alert('Error al guardar los datos. Revisa la consola.');
      setLoadingEmpresa(false);
    }
  };

  // Manejador de cambios para el formulario de empresa
  const handleEmpresaChange = (e) => {
    const { name, value } = e.target;
    setFormDataEmpresa(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manejador para cuando se selecciona un archivo de logo
  const handleLogoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file); // Guarda el archivo para subirlo
      setLogoUrl(URL.createObjectURL(file)); // Crea una vista previa local
    }
  };

  // Nueva función para guardar los datos en Firestore
  const saveConfigData = async (dataToSave) => {
    try {
      const docRef = doc(db, 'config', 'company');
      await setDoc(docRef, dataToSave, { merge: true });
      alert('Datos de la empresa actualizados correctamente.');
    } catch (error) {
      console.error('Error al guardar datos de la empresa:', error);
      throw error; // Lanza el error para que handleSubmit lo atrape
    }
  };

  // ============================================
  // FUNCIONES PARA GESTIÓN DE USUARIOS (Functions)
  // ============================================

  // Verificar si un email es de un cliente corporativo B2B
  const esClienteB2B = async (email) => {
    try {
      const clientesRef = collection(db, 'clientes_corporativos');
      const q = query(clientesRef, where('credenciales.email', '==', email));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error verificando cliente B2B:', error);
      return false;
    }
  };

  // Cargar lista de usuarios
  const fetchUsuarios = async () => {
    setLoadingUsers(true);
    try {
      const listUsersFunction = httpsCallable(functions, 'listUsers');
      const result = await listUsersFunction();

      // Verificar cuáles usuarios son clientes B2B
      const usersWithB2BFlag = await Promise.all(
        result.data.users.map(async (user) => {
          const isB2B = await esClienteB2B(user.email);
          return { ...user, isB2B };
        })
      );

      setUsers(usersWithB2BFlag);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      alert(`Error al cargar usuarios: ${error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Crear nuevo usuario
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserData.email || !newUserData.password) {
      alert('Email y contraseña son requeridos.');
      return;
    }
    setLoadingUsers(true); // Reusamos el loading
    try {
      const createUserFunction = httpsCallable(functions, 'createUser');
      const result = await createUserFunction(newUserData);

      // Añadir el nuevo usuario a la lista local
      setUsers(prevUsers => [...prevUsers, result.data.user]);
      alert('Usuario creado exitosamente.');
      setShowUserModal(false);
      setNewUserData({ email: '', password: '', role: 'vendedor' });
    } catch (error) {
      console.error('Error al crear usuario:', error);
      alert(`Error al crear usuario: ${error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Borrar un usuario
  const handleDeleteUser = async (uid, email) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${email}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setLoadingUsers(true);
    try {
      const deleteUserFunction = httpsCallable(functions, 'deleteUser');
      await deleteUserFunction({ uid: uid });

      // Quitar el usuario de la lista local
      setUsers(prevUsers => prevUsers.filter(user => user.uid !== uid));
      alert('Usuario eliminado exitosamente.');
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      alert(`Error al eliminar usuario: ${error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Manejador de cambios para el formulario de nuevo usuario
  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    setNewUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ============================================
  // FUNCIONES PARA GESTIÓN DE CLIENTES B2B
  // ============================================

  // Cargar lista de clientes corporativos
  const fetchClientesB2B = async () => {
    setLoadingB2B(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'clientes_corporativos'));
      const clientesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientesB2B(clientesData);
    } catch (error) {
      console.error('Error al cargar clientes B2B:', error);
      alert('Error al cargar clientes B2B: ' + error.message);
    } finally {
      setLoadingB2B(false);
    }
  };

  // Crear nuevo cliente B2B
  const handleCreateClienteB2B = async (e) => {
    e.preventDefault();

    if (!formDataB2B.nombre || !formDataB2B.codigoColegio || !formDataB2B.email) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoadingB2B(true);
    try {
      if (editingB2BId) {
        // Actualizar cliente existente
        const clienteRef = doc(db, 'clientes_corporativos', editingB2BId);
        await updateDoc(clienteRef, {
          nombre: formDataB2B.nombre.trim(),
          codigoColegio: formDataB2B.codigoColegio.trim().toUpperCase(),
          credenciales: {
            email: formDataB2B.email.trim()
          },
          contacto: {
            nombre: formDataB2B.contactoNombre.trim(),
            telefono: formDataB2B.contactoTelefono.trim()
          },
          activo: formDataB2B.activo
        });
        alert('Cliente B2B actualizado correctamente');
      } else {
        // Crear nuevo cliente
        // 1. Crear usuario en Firebase Authentication
        const createUserFunction = httpsCallable(functions, 'createUser');
        const userResult = await createUserFunction({
          email: formDataB2B.email.trim(),
          password: formDataB2B.password || '123456', // Password por defecto si no se proporciona
          role: 'b2b' // Aunque no se usa, lo marcamos
        });

        // 2. Crear documento en clientes_corporativos
        await addDoc(collection(db, 'clientes_corporativos'), {
          nombre: formDataB2B.nombre.trim(),
          codigoColegio: formDataB2B.codigoColegio.trim().toUpperCase(),
          credenciales: {
            email: formDataB2B.email.trim()
          },
          contacto: {
            nombre: formDataB2B.contactoNombre.trim(),
            telefono: formDataB2B.contactoTelefono.trim()
          },
          activo: true,
          createdAt: serverTimestamp()
        });

        alert('Cliente B2B creado correctamente');
      }

      // Limpiar formulario y recargar
      setFormDataB2B({
        nombre: '',
        codigoColegio: '',
        email: '',
        password: '',
        contactoNombre: '',
        contactoTelefono: '',
        activo: true
      });
      setEditingB2BId(null);
      setShowB2BModal(false);
      fetchClientesB2B();
    } catch (error) {
      console.error('Error al guardar cliente B2B:', error);
      alert('Error al guardar cliente B2B: ' + error.message);
    } finally {
      setLoadingB2B(false);
    }
  };

  // Editar cliente B2B
  const handleEditClienteB2B = (cliente) => {
    setFormDataB2B({
      nombre: cliente.nombre || '',
      codigoColegio: cliente.codigoColegio || '',
      email: cliente.credenciales?.email || '',
      password: '', // No mostramos la password
      contactoNombre: cliente.contacto?.nombre || '',
      contactoTelefono: cliente.contacto?.telefono || '',
      activo: cliente.activo !== false
    });
    setEditingB2BId(cliente.id);
    setShowB2BModal(true);
  };

  // Eliminar cliente B2B
  const handleDeleteClienteB2B = async (id, nombre, email) => {
    if (!window.confirm(`¿Estás seguro de eliminar el cliente "${nombre}"? Esto también eliminará su usuario de autenticación.`)) {
      return;
    }

    setLoadingB2B(true);
    try {
      // 1. Buscar y eliminar el usuario de Authentication
      const listUsersFunction = httpsCallable(functions, 'listUsers');
      const result = await listUsersFunction();
      const user = result.data.users.find(u => u.email === email);

      if (user) {
        const deleteUserFunction = httpsCallable(functions, 'deleteUser');
        await deleteUserFunction({ uid: user.uid });
      }

      // 2. Eliminar documento de clientes_corporativos
      await deleteDoc(doc(db, 'clientes_corporativos', id));

      alert('Cliente B2B eliminado correctamente');
      fetchClientesB2B();
    } catch (error) {
      console.error('Error al eliminar cliente B2B:', error);
      alert('Error al eliminar cliente B2B: ' + error.message);
    } finally {
      setLoadingB2B(false);
    }
  };

  // Manejador de cambios para formulario B2B
  const handleB2BFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormDataB2B(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ============================================
  // FUNCIONES PARA GESTIÓN DE PEDIDOS B2B
  // ============================================

  // Cargar lista de pedidos B2B
  const fetchPedidosB2B = async () => {
    setLoadingPedidosB2B(true);
    try {
      const querySnapshot = await getDocs(
        query(collection(db, 'pedidos_b2b'), orderBy('createdAt', 'desc'))
      );
      const pedidosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPedidosB2B(pedidosData);
    } catch (error) {
      console.error('Error al cargar pedidos B2B:', error);
      alert('Error al cargar pedidos B2B: ' + error.message);
    } finally {
      setLoadingPedidosB2B(false);
    }
  };

  // Actualizar estado del pedido
  const handleUpdateEstadoPedido = async (pedidoId, nuevoEstado) => {
    if (!window.confirm(`¿Cambiar el estado del pedido a "${nuevoEstado}"?`)) {
      return;
    }

    setLoadingPedidosB2B(true);
    try {
      const pedidoRef = doc(db, 'pedidos_b2b', pedidoId);
      await updateDoc(pedidoRef, {
        estado: nuevoEstado,
        updatedAt: serverTimestamp()
      });

      alert('Estado del pedido actualizado correctamente');
      fetchPedidosB2B();
      setShowPedidoModal(false);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar estado: ' + error.message);
    } finally {
      setLoadingPedidosB2B(false);
    }
  };

  // Abrir modal de detalle del pedido
  const handleVerPedido = async (pedido) => {
    setSelectedPedido(pedido);
    setShowPedidoModal(true);

    // Cargar información de stock para cada producto del pedido
    try {
      const stockData = {};
      for (const producto of pedido.productos || []) {
        if (producto.productoId) {
          const productoDoc = await getDoc(doc(db, 'products', producto.productoId));
          if (productoDoc.exists()) {
            stockData[producto.productoId] = productoDoc.data().stockDisponible || 0;
          }
        }
      }
      setStockInfo(stockData);
    } catch (error) {
      console.error('Error al cargar stock:', error);
    }
  };

  // Helpers para pedidos
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

  const getEstadoBadgeColor = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'En Preparación':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Despachado':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Entregado':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Configuración</h1>
      <p className="text-xs sm:text-sm text-gray-500 mb-6">Solo administradores</p>

      {/* Sistema de Pestañas */}
      <div className="border-b border-gray-300 mb-6 overflow-x-auto">
        <div className="flex space-x-4 sm:space-x-8 min-w-max sm:min-w-0">
          <button
            onClick={() => setActiveTab('colegios')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'colegios'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Gestión de Colegios</span>
            <span className="sm:hidden">Colegios</span>
          </button>
          <button
            onClick={() => setActiveTab('empresa')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'empresa'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Datos de la Empresa</span>
            <span className="sm:hidden">Empresa</span>
          </button>
          <button
            onClick={() => setActiveTab('satelites')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'satelites'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Gestión de Satélites</span>
            <span className="sm:hidden">Satélites</span>
          </button>
          <button
            onClick={() => setActiveTab('proveedores')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'proveedores'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Gestión de Proveedores</span>
            <span className="sm:hidden">Proveedores</span>
          </button>
          <button
            onClick={() => setActiveTab('costos')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'costos'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Gestión de Costos</span>
            <span className="sm:hidden">Costos</span>
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'usuarios'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Gestión de Usuarios</span>
            <span className="sm:hidden">Usuarios</span>
          </button>
          <button
            onClick={() => setActiveTab('clientesB2B')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'clientesB2B'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Clientes B2B</span>
            <span className="sm:hidden">B2B</span>
          </button>
          <button
            onClick={() => setActiveTab('pedidosB2B')}
            className={`pb-3 px-1 text-sm sm:text-base font-medium transition-colors whitespace-nowrap ${
              activeTab === 'pedidosB2B'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="hidden sm:inline">Pedidos B2B</span>
            <span className="sm:hidden">Pedidos</span>
          </button>
        </div>
      </div>

      {/* Contenido de las Pestañas */}
      {activeTab === 'colegios' && (
        <div>
          {/* Formulario Crear/Editar */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {editingId ? 'Editar Colegio' : 'Agregar Nuevo Colegio'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Colegio
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Gimnasio Moderno Santa Bárbara"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ej: GMSB"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
                  disabled={loading}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : editingId ? 'Actualizar Colegio' : 'Guardar Colegio'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={loading}
                    className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Tabla de Colegios */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Lista de Colegios</h2>
            </div>
            {loading && colegios.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Cargando colegios...</div>
            ) : colegios.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm sm:text-base">
                No hay colegios registrados. Agrega uno nuevo usando el formulario de arriba.
              </div>
            ) : (
              <>
                {/* Vista de Tarjetas - Solo Móvil */}
                <div className="md:hidden divide-y divide-gray-200">
                  {colegios.map((colegio) => (
                    <div key={colegio.id} className="p-4">
                      <div className="mb-3">
                        <p className="font-semibold text-gray-900 text-base">{colegio.nombre}</p>
                        <p className="text-sm text-gray-600 font-mono mt-1">Código: {colegio.codigo}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(colegio)}
                          disabled={loading}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(colegio.id, colegio.nombre)}
                          disabled={loading}
                          className="flex-1 px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista de Tabla - Solo Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre del Colegio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Código
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {colegios.map((colegio) => (
                        <tr key={colegio.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {colegio.nombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                            {colegio.codigo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <button
                              onClick={() => handleEdit(colegio)}
                              disabled={loading}
                              className="px-4 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(colegio.id, colegio.nombre)}
                              disabled={loading}
                              className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'satelites' && (
        <div>
          {/* Formulario Crear/Editar Satélite */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {editingIdSatelite ? 'Editar Satélite' : 'Agregar Nuevo Satélite'}
            </h2>
            <form onSubmit={handleSubmitSatelite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Satélite
                </label>
                <input
                  type="text"
                  value={formDataSatelite.nombre}
                  onChange={(e) => setFormDataSatelite({ ...formDataSatelite, nombre: e.target.value })}
                  placeholder="Ej: Taller Doña Ana"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loadingSatelite}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código (Opcional)
                </label>
                <input
                  type="text"
                  value={formDataSatelite.codigo}
                  onChange={(e) => setFormDataSatelite({ ...formDataSatelite, codigo: e.target.value })}
                  placeholder="Ej: TDA (opcional)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
                  disabled={loadingSatelite}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Identificador corto. Déjalo vacío si el satélite trabaja con varios colegios
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Cédula
                </label>
                <input
                  type="text"
                  value={formDataSatelite.cedula}
                  onChange={(e) => setFormDataSatelite({ ...formDataSatelite, cedula: e.target.value })}
                  placeholder="Ej: 1234567890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loadingSatelite}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={formDataSatelite.telefono}
                  onChange={(e) => setFormDataSatelite({ ...formDataSatelite, telefono: e.target.value })}
                  placeholder="Ej: 3001234567"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loadingSatelite}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formDataSatelite.direccion}
                  onChange={(e) => setFormDataSatelite({ ...formDataSatelite, direccion: e.target.value })}
                  placeholder="Ej: Calle 123 #45-67"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loadingSatelite}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loadingSatelite}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingSatelite ? 'Guardando...' : editingIdSatelite ? 'Actualizar Satélite' : 'Guardar Satélite'}
                </button>
                {editingIdSatelite && (
                  <button
                    type="button"
                    onClick={handleCancelSatelite}
                    disabled={loadingSatelite}
                    className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Tabla de Satélites */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Lista de Satélites</h2>
            </div>
            {loadingSatelite && satelites.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Cargando satélites...</div>
            ) : satelites.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm sm:text-base">
                No hay satélites registrados. Agrega uno nuevo usando el formulario de arriba.
              </div>
            ) : (
              <>
                {/* Vista de Tarjetas - Solo Móvil */}
                <div className="md:hidden divide-y divide-gray-200">
                  {satelites.map((satelite) => (
                    <div key={satelite.id} className="p-4">
                      <div className="mb-3">
                        <p className="font-semibold text-gray-900 text-base">{satelite.nombre}</p>
                        <p className="text-sm text-gray-600 font-mono mt-1">Código: {satelite.codigo}</p>
                        {satelite.cedula && (
                          <p className="text-sm text-gray-600 mt-1">Cédula: {satelite.cedula}</p>
                        )}
                        {satelite.telefono && (
                          <p className="text-sm text-gray-600 mt-1">Teléfono: {satelite.telefono}</p>
                        )}
                        {satelite.direccion && (
                          <p className="text-sm text-gray-600 mt-1">Dirección: {satelite.direccion}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSatelite(satelite)}
                          disabled={loadingSatelite}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteSatelite(satelite.id, satelite.nombre)}
                          disabled={loadingSatelite}
                          className="flex-1 px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista de Tabla - Solo Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Código
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cédula
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teléfono
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dirección
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {satelites.map((satelite) => (
                        <tr key={satelite.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {satelite.nombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                            {satelite.codigo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {satelite.cedula || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {satelite.telefono || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {satelite.direccion || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <button
                              onClick={() => handleEditSatelite(satelite)}
                              disabled={loadingSatelite}
                              className="px-4 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteSatelite(satelite.id, satelite.nombre)}
                              disabled={loadingSatelite}
                              className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'proveedores' && (
        <div>
          {/* Formulario Crear/Editar Proveedor */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {editingIdProveedor ? 'Editar Proveedor' : 'Agregar Nuevo Proveedor'}
            </h2>
            <form onSubmit={handleSubmitProveedor} className="space-y-4">
              {/* Campos del formulario */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Proveedor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formDataProveedor.nombre}
                    onChange={(e) => setFormDataProveedor({ ...formDataProveedor, nombre: e.target.value })}
                    placeholder="Ej: Telas y Suministros SAS"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loadingProveedor}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIT / Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formDataProveedor.nit}
                    onChange={(e) => setFormDataProveedor({ ...formDataProveedor, nit: e.target.value })}
                    placeholder="Ej: 900.123.456-7"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loadingProveedor}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formDataProveedor.telefono}
                    onChange={(e) => setFormDataProveedor({ ...formDataProveedor, telefono: e.target.value })}
                    placeholder="Ej: 3001234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loadingProveedor}
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loadingProveedor}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingProveedor ? 'Guardando...' : editingIdProveedor ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
                </button>
                {editingIdProveedor && (
                  <button
                    type="button"
                    onClick={handleCancelProveedor}
                    disabled={loadingProveedor}
                    className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Tabla de Proveedores */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Lista de Proveedores</h2>
            </div>
            {loadingProveedor && proveedores.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Cargando proveedores...</div>
            ) : proveedores.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm sm:text-base">
                No hay proveedores registrados.
              </div>
            ) : (
              <>
                {/* Vista de Tarjetas - Solo Móvil */}
                <div className="md:hidden divide-y divide-gray-200">
                  {proveedores.map((proveedor) => (
                    <div key={proveedor.id} className="p-4">
                      <div className="mb-3">
                        <p className="font-semibold text-gray-900 text-base">{proveedor.nombre}</p>
                        <p className="text-sm text-gray-600 font-mono mt-1">NIT: {proveedor.nit}</p>
                        <p className="text-sm text-gray-600 mt-1">Tel: {proveedor.telefono || 'No especificado'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditProveedor(proveedor)}
                          disabled={loadingProveedor}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteProveedor(proveedor.id, proveedor.nombre)}
                          disabled={loadingProveedor}
                          className="flex-1 px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista de Tabla - Solo Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre del Proveedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          NIT / Documento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teléfono
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {proveedores.map((proveedor) => (
                        <tr key={proveedor.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {proveedor.nombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                            {proveedor.nit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {proveedor.telefono || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <button
                              onClick={() => handleEditProveedor(proveedor)}
                              disabled={loadingProveedor}
                              className="px-4 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteProveedor(proveedor.id, proveedor.nombre)}
                              disabled={loadingProveedor}
                              className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'empresa' && (
        <div>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Datos de la Empresa
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Esta información aparecerá en todas las tirillas y facturas.
            </p>
            {loadingEmpresa && !uploadProgress ? (
              <div className="p-8 text-center text-gray-500">Cargando datos...</div>
            ) : (
              <form onSubmit={handleSubmitEmpresa} className="space-y-4">

                {/* --- Sección del Logo --- */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo de la Empresa
                  </label>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-20 h-20 rounded-full object-cover border border-gray-300"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        Sin Logo
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handleLogoChange}
                      className="block w-full text-sm text-gray-500
                                 file:mr-4 file:py-2 file:px-4
                                 file:rounded-full file:border-0
                                 file:text-sm file:font-semibold
                                 file:bg-pink-50 file:text-pink-700
                                 hover:file:bg-pink-100"
                    />
                  </div>
                  {/* Barra de Progreso */}
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                      <div
                        className="bg-pink-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
                {/* --- Fin Sección del Logo --- */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre de la Empresa
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formDataEmpresa.nombre}
                      onChange={handleEmpresaChange}
                      placeholder="Ej: Uniformes Martha Romero"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NIT / Documento
                    </label>
                    <input
                      type="text"
                      name="nit"
                      value={formDataEmpresa.nit}
                      onChange={handleEmpresaChange}
                      placeholder="Ej: 123.456.789-0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="direccion"
                      value={formDataEmpresa.direccion}
                      onChange={handleEmpresaChange}
                      placeholder="Ej: Calle 10 # 5-20 Local 1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      name="telefono"
                      value={formDataEmpresa.telefono}
                      onChange={handleEmpresaChange}
                      placeholder="Ej: 300 123 4567"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pie de Factura (Opcional)
                    </label>
                    <input
                      type="text"
                      name="pieDeFactura"
                      value={formDataEmpresa.pieDeFactura}
                      onChange={handleEmpresaChange}
                      placeholder="Ej: ¡Gracias por su compra!"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={loadingEmpresa}
                    style={{ backgroundColor: '#D50565' }}
                    className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingEmpresa ? (uploadProgress ? `Subiendo... ${Math.round(uploadProgress)}%` : 'Guardando...') : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === 'usuarios' && (
        <div>
          {/* Botón para añadir usuario */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowUserModal(true)}
              style={{ backgroundColor: '#D50565' }}
              className="px-4 py-2 sm:px-6 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              + Añadir Nuevo Usuario
            </button>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Lista de Usuarios</h2>
            </div>
            {loadingUsers && users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Cargando usuarios...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No hay usuarios registrados (además de ti).
              </div>
            ) : (
              <>
                {/* Vista Mobile - Cards */}
                <div className="md:hidden divide-y divide-gray-200">
                  {users.map((user) => (
                    <div key={user.uid} className="p-4">
                      <div className="mb-3">
                        <p className="font-semibold text-gray-900 text-base mb-2">{user.email}</p>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-gray-600">Rol:</span>
                          {user.isB2B ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                              Cliente B2B
                            </span>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              user.role === 'admin' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role || 'Sin Rol'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono break-all">UID: {user.uid}</p>
                      </div>
                      {user.isB2B ? (
                        <div className="w-full px-4 py-2 bg-gray-200 text-gray-500 text-sm rounded text-center">
                          Usuario B2B (Portal)
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteUser(user.uid, user.email)}
                          disabled={loadingUsers}
                          className="w-full px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Vista Desktop - Tabla */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UID</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.uid} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {user.isB2B ? (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                Cliente B2B
                              </span>
                            ) : (
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                user.role === 'admin' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.role || 'Sin Rol'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                            {user.uid}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            {user.isB2B ? (
                              <span className="px-4 py-1.5 bg-gray-200 text-gray-500 rounded text-xs">
                                Usuario B2B (Portal)
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(user.uid, user.email)}
                                disabled={loadingUsers}
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
        </div>
      )}

      {/* CONTENIDO PESTAÑA CLIENTES B2B */}
      {activeTab === 'clientesB2B' && (
        <div>
          {/* Botón para añadir cliente */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                setShowB2BModal(true);
                setEditingB2BId(null);
                setFormDataB2B({
                  nombre: '',
                  codigoColegio: '',
                  email: '',
                  password: '',
                  contactoNombre: '',
                  contactoTelefono: '',
                  activo: true
                });
              }}
              style={{ backgroundColor: '#D50565' }}
              className="px-4 py-2 sm:px-6 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              + Añadir Cliente B2B
            </button>
          </div>

          {/* Tabla de Clientes B2B */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Lista de Clientes B2B</h2>
            </div>
            {loadingB2B && clientesB2B.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Cargando clientes...</div>
            ) : clientesB2B.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No hay clientes B2B registrados.
              </div>
            ) : (
              <>
                {/* Vista Mobile - Cards */}
                <div className="md:hidden divide-y divide-gray-200">
                  {clientesB2B.map((cliente) => (
                    <div key={cliente.id} className="p-4">
                      <div className="mb-3">
                        <p className="font-semibold text-gray-900 text-base mb-2">{cliente.nombre}</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600">
                            <span className="font-medium">Email:</span> {cliente.credenciales?.email}
                          </p>
                          <p className="text-gray-600">
                            <span className="font-medium">Colegio:</span> {cliente.codigoColegio}
                          </p>
                          {cliente.contacto?.nombre && (
                            <p className="text-gray-600">
                              <span className="font-medium">Contacto:</span> {cliente.contacto.nombre}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              cliente.activo !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {cliente.activo !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClienteB2B(cliente)}
                          disabled={loadingB2B}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteClienteB2B(cliente.id, cliente.nombre, cliente.credenciales?.email)}
                          disabled={loadingB2B}
                          className="flex-1 px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista Desktop - Tabla */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Colegio</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clientesB2B.map((cliente) => (
                        <tr key={cliente.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {cliente.nombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {cliente.credenciales?.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                            {cliente.codigoColegio}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {cliente.contacto?.nombre || '-'}
                            {cliente.contacto?.telefono && <div className="text-xs text-gray-500">{cliente.contacto.telefono}</div>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              cliente.activo !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {cliente.activo !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <button
                              onClick={() => handleEditClienteB2B(cliente)}
                              disabled={loadingB2B}
                              className="px-4 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteClienteB2B(cliente.id, cliente.nombre, cliente.credenciales?.email)}
                              disabled={loadingB2B}
                              className="px-4 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA GESTIÓN DE COSTOS */}
      {activeTab === 'costos' && (
        <GestionCostos />
      )}

      {/* CONTENIDO PESTAÑA PEDIDOS B2B */}
      {activeTab === 'pedidosB2B' && (
        <div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Gestión de Pedidos B2B
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {pedidosB2B.length} {pedidosB2B.length === 1 ? 'pedido registrado' : 'pedidos registrados'}
                </p>
              </div>
              <button
                onClick={fetchPedidosB2B}
                disabled={loadingPedidosB2B}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                Actualizar
              </button>
            </div>

            {loadingPedidosB2B ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Cargando pedidos...</p>
              </div>
            ) : pedidosB2B.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No hay pedidos B2B registrados</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pedidosB2B.map((pedido) => (
                  <div
                    key={pedido.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-800">
                            Pedido #{pedido.id.slice(-6).toUpperCase()}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getEstadoBadgeColor(
                              pedido.estado
                            )}`}
                          >
                            {pedido.estado}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Cliente:</span> {pedido.clienteNombre}
                          </div>
                          <div>
                            <span className="font-medium">Fecha:</span> {formatDate(pedido.createdAt)}
                          </div>
                          <div>
                            <span className="font-medium">Productos:</span> {pedido.productos?.length || 0}
                          </div>
                          <div>
                            <span className="font-medium">Total:</span>{' '}
                            <span className="font-bold text-primary">
                              {formatCurrency(pedido.total)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerPedido(pedido)}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors"
                          style={{ backgroundColor: '#D50565' }}
                        >
                          Ver Detalle
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para Crear Usuario */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                Añadir Nuevo Usuario
              </h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={newUserData.email}
                  onChange={handleUserFormChange}
                  placeholder="nuevo.vendedor@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={newUserData.password}
                  onChange={handleUserFormChange}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={newUserData.role}
                  onChange={handleUserFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loadingUsers}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loadingUsers ? 'Creando...' : 'Crear Usuario'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  disabled={loadingUsers}
                  className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Crear/Editar Cliente B2B */}
      {showB2BModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-2xl font-semibold text-gray-800">
                {editingB2BId ? 'Editar Cliente B2B' : 'Añadir Nuevo Cliente B2B'}
              </h2>
              <button
                onClick={() => {
                  setShowB2BModal(false);
                  setEditingB2BId(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateClienteB2B} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formDataB2B.nombre}
                    onChange={handleB2BFormChange}
                    placeholder="Ej: Colegio San José"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código del Colegio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="codigoColegio"
                    value={formDataB2B.codigoColegio}
                    onChange={handleB2BFormChange}
                    placeholder="Ej: GAR"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Debe coincidir con un colegio existente
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email de Acceso <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formDataB2B.email}
                    onChange={handleB2BFormChange}
                    placeholder="cliente@colegio.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    disabled={editingB2BId} // No permitir cambiar email al editar
                  />
                </div>

                {!editingB2BId && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña {!editingB2BId && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formDataB2B.password}
                      onChange={handleB2BFormChange}
                      placeholder={editingB2BId ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      required={!editingB2BId}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de Contacto
                  </label>
                  <input
                    type="text"
                    name="contactoNombre"
                    value={formDataB2B.contactoNombre}
                    onChange={handleB2BFormChange}
                    placeholder="Ej: María González"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    name="contactoTelefono"
                    value={formDataB2B.contactoTelefono}
                    onChange={handleB2BFormChange}
                    placeholder="Ej: 3001234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {editingB2BId && (
                  <div className="md:col-span-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="activo"
                        checked={formDataB2B.activo}
                        onChange={handleB2BFormChange}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-gray-700">Cliente Activo</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Los clientes inactivos no podrán acceder al portal
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loadingB2B}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loadingB2B ? 'Guardando...' : editingB2BId ? 'Actualizar Cliente' : 'Crear Cliente'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowB2BModal(false);
                    setEditingB2BId(null);
                  }}
                  disabled={loadingB2B}
                  className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Ver Detalle de Pedido B2B */}
      {showPedidoModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center" style={{ backgroundColor: '#D50565' }}>
              <h2 className="text-2xl font-semibold text-white">
                Detalle del Pedido #{selectedPedido.id.slice(-6).toUpperCase()}
              </h2>
              <button
                onClick={() => {
                  setShowPedidoModal(false);
                  setSelectedPedido(null);
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* Información del Cliente */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Información del Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Cliente</p>
                    <p className="font-medium text-gray-800">{selectedPedido.clienteNombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Código Colegio</p>
                    <p className="font-medium text-gray-800">{selectedPedido.codigoColegio}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha del Pedido</p>
                    <p className="font-medium text-gray-800">{formatDate(selectedPedido.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estado</p>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getEstadoBadgeColor(
                        selectedPedido.estado
                      )}`}
                    >
                      {selectedPedido.estado}
                    </span>
                  </div>
                </div>
              </div>

              {/* Productos del Pedido */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Productos del Pedido</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Producto</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Talla</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Pedido</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">En Stock</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">A Producir</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedPedido.productos?.map((producto, index) => {
                        const stockDisponible = stockInfo[producto.productoId] || 0;
                        const aProducir = Math.max(0, producto.cantidad - stockDisponible);
                        const enStock = Math.min(producto.cantidad, stockDisponible);

                        return (
                          <tr key={index} className="bg-white hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{producto.descripcion}</p>
                              <p className="text-xs text-gray-500">{producto.codigo}</p>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-800">
                              {producto.talla}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-gray-900">{producto.cantidad}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-medium ${enStock > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {enStock}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {aProducir > 0 ? (
                                <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 font-semibold rounded-full text-sm">
                                  {aProducir}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-semibold text-gray-800">
                                {formatCurrency(producto.subtotal)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(producto.precioUnitario)} c/u
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de Producción */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700 font-medium">Total en Stock</p>
                    <p className="text-2xl font-bold text-green-800">
                      {selectedPedido.productos?.reduce((total, prod) => {
                        const stockDisponible = stockInfo[prod.productoId] || 0;
                        return total + Math.min(prod.cantidad, stockDisponible);
                      }, 0) || 0}
                    </p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-700 font-medium">Total a Producir</p>
                    <p className="text-2xl font-bold text-orange-800">
                      {selectedPedido.productos?.reduce((total, prod) => {
                        const stockDisponible = stockInfo[prod.productoId] || 0;
                        return total + Math.max(0, prod.cantidad - stockDisponible);
                      }, 0) || 0}
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700 font-medium">Total de Prendas</p>
                    <p className="text-2xl font-bold text-blue-800">
                      {selectedPedido.productos?.reduce((total, prod) => total + prod.cantidad, 0) || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {selectedPedido.notas && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Notas</h3>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedPedido.notas}</p>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border-2" style={{ borderColor: '#D50565' }}>
                <span className="text-xl font-bold text-gray-800">Total del Pedido:</span>
                <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                  {formatCurrency(selectedPedido.total)}
                </span>
              </div>

              {/* Cambiar Estado */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Cambiar Estado del Pedido</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Pendiente', 'En Preparación', 'Despachado', 'Entregado'].map((estado) => (
                    <button
                      key={estado}
                      onClick={() => handleUpdateEstadoPedido(selectedPedido.id, estado)}
                      disabled={selectedPedido.estado === estado || loadingPedidosB2B}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        selectedPedido.estado === estado
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50'
                      }`}
                    >
                      {estado}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowPedidoModal(false);
                  setSelectedPedido(null);
                }}
                className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Config;
