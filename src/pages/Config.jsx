import { useState, useEffect } from 'react';
import { db, functions, storage } from '../services/firebase';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ref, uploadBytesResumable, getDownloadURL
} from 'firebase/storage';

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

    if (!formDataSatelite.nombre.trim() || !formDataSatelite.codigo.trim()) {
      alert('Por favor, completa al menos el nombre y código.');
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

  // Cargar lista de usuarios
  const fetchUsuarios = async () => {
    setLoadingUsers(true);
    try {
      const listUsersFunction = httpsCallable(functions, 'listUsers');
      const result = await listUsersFunction();
      setUsers(result.data.users);
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
                  Código
                </label>
                <input
                  type="text"
                  value={formDataSatelite.codigo}
                  onChange={(e) => setFormDataSatelite({ ...formDataSatelite, codigo: e.target.value })}
                  placeholder="Ej: TDA"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
                  disabled={loadingSatelite}
                />
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
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            user.role === 'admin' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono break-all">UID: {user.uid}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(user.uid, user.email)}
                        disabled={loadingUsers}
                        className="w-full px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Eliminar
                      </button>
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
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              user.role === 'admin' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                            {user.uid}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <button
                              onClick={() => handleDeleteUser(user.uid, user.email)}
                              disabled={loadingUsers}
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
    </div>
  );
};

export default Config;
