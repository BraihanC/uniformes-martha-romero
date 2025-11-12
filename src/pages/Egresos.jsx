import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const Egresos = () => {
  const { currentUser } = useAuth();

  // Estados del formulario
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState('Insumos y materiales');
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  // Estados de la lista
  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroMetodo, setFiltroMetodo] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Estados para edición
  const [editandoId, setEditandoId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [egresoAEliminar, setEgresoAEliminar] = useState(null);

  const categorias = [
    'Insumos y materiales',
    'Productos de aseo',
    'Alimentación',
    'Transporte',
    'Servicios (luz, agua, internet)',
    'Mantenimiento',
    'Otros'
  ];

  const metodosPago = ['Efectivo', 'Nequi', 'Daviplata', 'Nu', 'Tarjeta'];

  useEffect(() => {
    fetchEgresos();
  }, []);

  const fetchEgresos = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'transactions'),
        where('tipo', '==', 'egreso'),
        orderBy('fecha', 'desc')
      );

      const snapshot = await getDocs(q);
      const egresosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha?.toDate() || new Date()
      }));

      setEgresos(egresosData);
    } catch (error) {
      console.error('Error al cargar egresos:', error);
      alert('Error al cargar egresos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!monto || !concepto) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    const montoNum = parseFloat(monto);
    if (montoNum <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    try {
      setLoading(true);

      if (editandoId) {
        // Actualizar egreso existente
        const egresoRef = doc(db, 'transactions', editandoId);
        await updateDoc(egresoRef, {
          monto: -montoNum, // Guardar como negativo
          concepto,
          categoria,
          metodoPago,
          updatedAt: serverTimestamp()
        });

        alert('Egreso actualizado exitosamente');
        setEditandoId(null);
      } else {
        // Crear nuevo egreso
        await addDoc(collection(db, 'transactions'), {
          tipo: 'egreso',
          monto: -montoNum, // Guardar como negativo para que reste en cierre de caja
          concepto,
          categoria,
          metodoPago,
          descripcion: concepto, // Agregar descripción para compatibilidad
          userId: currentUser.uid,
          fecha: serverTimestamp(),
          createdAt: serverTimestamp()
        });

        alert('Egreso registrado exitosamente');
      }

      // Limpiar formulario
      setMonto('');
      setConcepto('');
      setCategoria('Insumos y materiales');
      setMetodoPago('Efectivo');

      fetchEgresos();
    } catch (error) {
      console.error('Error al guardar egreso:', error);
      alert('Error al guardar egreso');
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (egreso) => {
    setMonto(Math.abs(egreso.monto).toString()); // Convertir a positivo para mostrar
    setConcepto(egreso.concepto);
    setCategoria(egreso.categoria);
    setMetodoPago(egreso.metodoPago);
    setEditandoId(egreso.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelarEdicion = () => {
    setMonto('');
    setConcepto('');
    setCategoria('Insumos y materiales');
    setMetodoPago('Efectivo');
    setEditandoId(null);
  };

  const handleEliminar = async () => {
    if (!egresoAEliminar) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, 'transactions', egresoAEliminar.id));
      alert('Egreso eliminado exitosamente');
      setShowDeleteConfirm(false);
      setEgresoAEliminar(null);
      fetchEgresos();
    } catch (error) {
      console.error('Error al eliminar egreso:', error);
      alert('Error al eliminar egreso');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar egresos
  const egresosFiltrados = egresos.filter(egreso => {
    // Filtro por categoría
    if (filtroCategoria !== 'Todas' && egreso.categoria !== filtroCategoria) {
      return false;
    }

    // Filtro por método de pago
    if (filtroMetodo !== 'Todos' && egreso.metodoPago !== filtroMetodo) {
      return false;
    }

    // Filtro por búsqueda
    if (busqueda && !egreso.concepto.toLowerCase().includes(busqueda.toLowerCase())) {
      return false;
    }

    // Filtro por fecha
    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      inicio.setHours(0, 0, 0, 0);
      if (egreso.fecha < inicio) return false;
    }

    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      if (egreso.fecha > fin) return false;
    }

    return true;
  });

  // Calcular totales (usar Math.abs porque los egresos se guardan negativos)
  const totalGeneral = egresosFiltrados.reduce((sum, e) => sum + Math.abs(e.monto), 0);
  const totalesPorCategoria = egresosFiltrados.reduce((acc, e) => {
    acc[e.categoria] = (acc[e.categoria] || 0) + Math.abs(e.monto);
    return acc;
  }, {});
  const totalesPorMetodo = egresosFiltrados.reduce((acc, e) => {
    acc[e.metodoPago] = (acc[e.metodoPago] || 0) + Math.abs(e.monto);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Registro de Egresos</h1>

        {/* Formulario de Registro */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {editandoId ? 'Editar Egreso' : 'Registrar Nuevo Egreso'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto *
                </label>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="0"
                  step="100"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría *
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                >
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago *
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                >
                  {metodosPago.map(metodo => (
                    <option key={metodo} value={metodo}>{metodo}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Concepto/Descripción *
                </label>
                <textarea
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Ej: Compra de marcadores permanentes"
                  rows="2"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#D50565' }}
              >
                {loading ? 'Guardando...' : (editandoId ? 'Actualizar Egreso' : 'Registrar Egreso')}
              </button>

              {editandoId && (
                <button
                  type="button"
                  onClick={handleCancelarEdicion}
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancelar Edición
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Filtros</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar por concepto
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Buscar..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="Todas">Todas</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={filtroMetodo}
                onChange={(e) => setFiltroMetodo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="Todos">Todos</option>
                {metodosPago.map(metodo => (
                  <option key={metodo} value={metodo}>{metodo}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setBusqueda('');
              setFiltroCategoria('Todas');
              setFiltroMetodo('Todos');
              setFechaInicio('');
              setFechaFin('');
            }}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Limpiar Filtros
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total General</h3>
            <p className="text-2xl font-bold text-red-600">
              ${totalGeneral.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Por Categoría</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(totalesPorCategoria).map(([cat, total]) => (
                <div key={cat} className="flex justify-between">
                  <span className="text-gray-600 truncate">{cat}:</span>
                  <span className="font-semibold">${total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Por Método de Pago</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(totalesPorMetodo).map(([metodo, total]) => (
                <div key={metodo} className="flex justify-between">
                  <span className="text-gray-600">{metodo}:</span>
                  <span className="font-semibold">${total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Historial de Egresos */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Historial de Egresos ({egresosFiltrados.length})
          </h2>

          {loading ? (
            <p className="text-center text-gray-500 py-8">Cargando...</p>
          ) : egresosFiltrados.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay egresos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Concepto</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Categoría</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Método</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Monto</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {egresosFiltrados.map(egreso => (
                    <tr key={egreso.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {egreso.fecha.toLocaleDateString('es-CO')}<br />
                        <span className="text-xs text-gray-400">
                          {egreso.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800">
                        {egreso.concepto}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {egreso.categoria}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {egreso.metodoPago}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-red-600 text-right">
                        ${Math.abs(egreso.monto).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleEditar(egreso)}
                          className="text-blue-600 hover:text-blue-800 mr-3 text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setEgresoAEliminar(egreso);
                            setShowDeleteConfirm(true);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirm && egresoAEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirmar Eliminación</h3>
            <p className="text-gray-600 mb-2">
              ¿Estás seguro de que deseas eliminar este egreso?
            </p>
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm"><strong>Concepto:</strong> {egresoAEliminar.concepto}</p>
              <p className="text-sm"><strong>Monto:</strong> ${Math.abs(egresoAEliminar.monto).toLocaleString()}</p>
              <p className="text-sm"><strong>Categoría:</strong> {egresoAEliminar.categoria}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEliminar}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEgresoAEliminar(null);
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Egresos;
