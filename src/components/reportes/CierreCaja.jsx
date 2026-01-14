import { useState, useEffect } from 'react';
import { db } from '../../services/firebase'; // Ajustado a ../../
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  CalendarDays,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Printer,
  BarChart2,
  Wallet,
  Edit2,
  Save,
  HandCoins
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// --- Helper Functions ---

/**
 * Formatea una fecha a 'YYYY-MM-DD' para los inputs tipo 'date'.
 * Tiene en cuenta la zona horaria local.
 */
const formatDateForInput = (date) => {
  if (!date) return '';
  // Clona la fecha para evitar mutaciones
  const localDate = new Date(date.getTime());
  // Ajusta por la zona horaria
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().split('T')[0];
};

/**
 * Formatea un número como moneda colombiana (COP).
 */
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// --- Componente Principal ---

const CierreCaja = () => { // <--- Nombre cambiado
  const { currentUser, isVendedor } = useAuth();
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Estados para base inicial de caja
  const [baseInicial, setBaseInicial] = useState(0);
  const [editandoBase, setEditandoBase] = useState(false);
  const [baseInputValue, setBaseInputValue] = useState('0');

  // Estados para modal de retiros de caja
  const [showRetiroModal, setShowRetiroModal] = useState(false);
  const [retiroMonto, setRetiroMonto] = useState('');
  const [retiroResponsable, setRetiroResponsable] = useState('Martha Romero');
  const [retiroNotas, setRetiroNotas] = useState('');

  /**
   * Carga el reporte de "Hoy" la primera vez que el componente se monta.
   */
  useEffect(() => {
    handleFetchReport();
    loadBaseInicial();
  }, []);

  /**
   * Carga la base inicial cuando cambian las fechas
   */
  useEffect(() => {
    loadBaseInicial();
  }, [startDate, endDate]);

  /**
   * Carga la base inicial del día desde Firebase
   */
  const loadBaseInicial = async () => {
    try {
      // Usar la fecha de inicio como referencia
      const dateKey = formatDateForInput(startDate);
      const baseDocRef = doc(db, 'bases_caja', dateKey);
      const baseDoc = await getDoc(baseDocRef);

      if (baseDoc.exists()) {
        const base = baseDoc.data().monto || 0;
        setBaseInicial(base);
        setBaseInputValue(base.toString());
      } else {
        // Si no existe, inicializar en 0
        setBaseInicial(0);
        setBaseInputValue('0');
      }
    } catch (error) {
      console.error('Error al cargar base inicial:', error);
      setBaseInicial(0);
      setBaseInputValue('0');
    }
  };

  /**
   * Guarda la base inicial del día en Firebase
   */
  const handleSaveBaseInicial = async () => {
    const monto = parseFloat(baseInputValue) || 0;

    try {
      const dateKey = formatDateForInput(startDate);
      const baseDocRef = doc(db, 'bases_caja', dateKey);

      await setDoc(baseDocRef, {
        fecha: startDate,
        monto: monto,
        updatedAt: new Date()
      });

      setBaseInicial(monto);
      setEditandoBase(false);
      alert('✅ Base inicial guardada correctamente');
    } catch (error) {
      console.error('Error al guardar base inicial:', error);
      alert('❌ Error al guardar base inicial: ' + error.message);
    }
  };

  /**
   * Define los rangos de fecha preestablecidos.
   */
  const setPresetDate = (preset) => {
    const today = new Date();
    if (preset === 'hoy') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'ayer') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      setStartDate(yesterday);
      setEndDate(yesterday);
    }
  };

  /**
   * Registra un retiro de caja
   */
  const handleRegistrarRetiro = async () => {
    const monto = parseFloat(retiroMonto);

    // Validaciones
    if (!monto || monto <= 0) {
      alert('Por favor, ingresa un monto válido mayor a 0.');
      return;
    }

    if (!retiroResponsable) {
      alert('Por favor, selecciona quién realiza el retiro.');
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas el retiro de ${formatCurrency(monto)}?\n\n` +
      `Retirado por: ${retiroResponsable}\n` +
      `${retiroNotas ? `Notas: ${retiroNotas}` : ''}`
    );

    if (!confirmar) return;

    try {
      setLoading(true);

      // Crear transacción de tipo retiro_caja
      await addDoc(collection(db, 'transactions'), {
        tipo: 'retiro_caja',
        monto: -monto, // Negativo porque sale de caja
        metodoPago: 'Efectivo', // Los retiros siempre son en efectivo
        descripcion: `Retiro de caja - ${retiroResponsable}`,
        responsable: retiroResponsable,
        notas: retiroNotas.trim() || '',
        userId: currentUser.uid,
        fecha: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      alert(`✅ Retiro de ${formatCurrency(monto)} registrado correctamente.`);

      // Limpiar formulario y cerrar modal
      setRetiroMonto('');
      setRetiroResponsable('Martha Romero');
      setRetiroNotas('');
      setShowRetiroModal(false);

      // Recargar el reporte
      handleFetchReport();

    } catch (error) {
      console.error('Error al registrar retiro:', error);
      alert('❌ Error al registrar el retiro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Función principal que busca y procesa las transacciones.
   */
  const handleFetchReport = async () => {
    setLoading(true);
    setReportData(null); // Limpia datos anteriores

    // 1. Definir el rango de tiempo (inicio del día y fin del día)
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0); // 00:00:00

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // 23:59:59

    // 2. Convertir a Timestamps de Firebase
    const startTimestamp = Timestamp.fromDate(start);
    const endTimestamp = Timestamp.fromDate(end);

    try {
      // 3. Crear la consulta
      const transCollectionRef = collection(db, 'transactions');
      const q = query(
        transCollectionRef,
        where('fecha', '>=', startTimestamp),
        where('fecha', '<=', endTimestamp),
        orderBy('fecha', 'desc')
      );

      // 4. Ejecutar la consulta
      const querySnapshot = await getDocs(q);
      const allTransactions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convertir timestamp de Firebase a Date de JS
        fecha: doc.data().fecha.toDate(),
      }));

      // FILTRAR transacciones pendientes (no afectan el flujo de caja)
      // Solo se incluyen cuando se marcan como pagadas con el método real
      const transactions = allTransactions.filter(t => t.metodoPago !== 'Pendiente');

      // 5. Procesar los datos
      let totalIngresos = 0;
      let totalEgresos = 0;
      let totalRetiros = 0;
      let totalIngresosEfectivo = 0; // Solo efectivo
      let totalEgresosEfectivo = 0;  // Solo efectivo
      const porMetodo = {};
      const porTipo = {};
      const egresosPorCategoria = {};
      const egresosPorMetodo = {};
      const retirosCaja = []; // Array para detalles de retiros

      transactions.forEach(t => {
        const monto = t.monto;
        const metodo = t.metodoPago || 'Indefinido';
        const tipo = t.tipo || 'Indefinido';

        // Procesar retiros de caja por separado
        if (tipo === 'retiro_caja') {
          totalRetiros += Math.abs(monto);
          retirosCaja.push({
            fecha: t.fecha,
            monto: Math.abs(monto),
            responsable: t.responsable || 'No especificado',
            notas: t.notas || ''
          });
        }
        // Sumar a Ingresos o Egresos (excluyendo retiros)
        else if (monto > 0) {
          totalIngresos += monto;
          // Solo contar efectivo para el cálculo de efectivo esperado
          if (metodo === 'Efectivo') {
            totalIngresosEfectivo += monto;
          }
        } else {
          totalEgresos += monto; // monto ya es negativo
          // Solo contar efectivo para el cálculo de efectivo esperado
          if (metodo === 'Efectivo') {
            totalEgresosEfectivo += monto;
          }
        }

        // Agrupar por Método de Pago (excluyendo retiros para no duplicar)
        if (tipo !== 'retiro_caja') {
          if (!porMetodo[metodo]) porMetodo[metodo] = { total: 0, ingresos: 0, egresos: 0 };
          porMetodo[metodo].total += monto;
          if (monto > 0) porMetodo[metodo].ingresos += monto;
          else porMetodo[metodo].egresos += monto;
        }

        // Agrupar por Tipo de Transacción
        if (!porTipo[tipo]) porTipo[tipo] = { total: 0, count: 0 };
        porTipo[tipo].total += monto;
        porTipo[tipo].count += 1;

        // Agrupar egresos por categoría y método
        if (tipo === 'egreso') {
          const categoria = t.categoria || 'Sin categoría';
          if (!egresosPorCategoria[categoria]) {
            egresosPorCategoria[categoria] = { total: 0, count: 0 };
          }
          egresosPorCategoria[categoria].total += Math.abs(monto);
          egresosPorCategoria[categoria].count += 1;

          // Egresos por método de pago
          if (!egresosPorMetodo[metodo]) {
            egresosPorMetodo[metodo] = 0;
          }
          egresosPorMetodo[metodo] += Math.abs(monto);
        }
      });

      const saldoNeto = totalIngresos + totalEgresos;
      const saldoNetoEfectivo = totalIngresosEfectivo + totalEgresosEfectivo;

      // 6. Guardar datos en el estado
      setReportData({
        transactions,
        totalIngresos,
        totalEgresos,
        totalRetiros,
        retirosCaja,
        saldoNeto,
        saldoNetoEfectivo,
        porMetodo,
        porTipo,
        egresosPorCategoria,
        egresosPorMetodo,
      });

    } catch (error) {
      console.error('Error al generar el reporte:', error);
      alert('Error al generar el reporte: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja la impresión del reporte.
   */
  const handlePrintReport = () => {
    window.print();
  };

  return (
    // Ya no necesitamos 'max-w-7xl' aquí porque el layout padre lo tendrá
    <div>
      {/* --- Encabezado y Selectores de Fecha --- */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Cierre de Caja</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Analiza el flujo de efectivo por rango de fechas.</p>
        </div>
        <div className="flex gap-2">
          {/* Botón Registrar Retiro - Disponible para todos */}
          <button
            onClick={() => setShowRetiroModal(true)}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#EA5C2E' }}
          >
            <HandCoins size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden sm:inline">Registrar Retiro</span>
            <span className="sm:hidden">Retiro</span>
          </button>

          {/* Botón Imprimir - Solo para Administradores */}
          {!isVendedor && (
            <button
              onClick={handlePrintReport}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#D50565' }}
            >
              <Printer size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Imprimir Reporte</span>
              <span className="sm:hidden">Imprimir</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtros de fecha - Solo para Administradores */}
      {!isVendedor && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            {/* Fecha Inicio */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Inicio
              </label>
              <input
                type="date"
                id="startDate"
                value={formatDateForInput(startDate)}
                onChange={(e) => {
                  // Crear fecha en zona horaria local evitando el problema de UTC
                  const [year, month, day] = e.target.value.split('-');
                  setStartDate(new Date(year, month - 1, day));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
              />
            </div>

            {/* Fecha Fin */}
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Fin
              </label>
              <input
                type="date"
                id="endDate"
                value={formatDateForInput(endDate)}
                onChange={(e) => {
                  // Crear fecha en zona horaria local evitando el problema de UTC
                  const [year, month, day] = e.target.value.split('-');
                  setEndDate(new Date(year, month - 1, day));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
              />
            </div>

            {/* Botones Presets */}
            <div className="flex gap-2 sm:col-span-2 md:col-span-1">
              <button
                onClick={() => setPresetDate('hoy')}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Hoy
              </button>
              <button
                onClick={() => setPresetDate('ayer')}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Ayer
              </button>
            </div>

            {/* Botón Generar */}
            <button
              onClick={handleFetchReport}
              disabled={loading}
              className="w-full px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white rounded-lg font-medium shadow-md transition-all disabled:opacity-50 sm:col-span-2 md:col-span-1"
              style={{ backgroundColor: '#D50565' }}
            >
              {loading ? 'Generando...' : 'Generar Reporte'}
            </button>
          </div>
        </div>
      )}

      {/* Base Inicial de Caja - Disponible para todos */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 print:hidden">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={20} className="text-blue-600" />
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Base Inicial de Caja</h3>
                <p className="text-xs text-gray-600">Dinero con el que inicia el día</p>
              </div>
            </div>

            {!editandoBase ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(baseInicial)}
                </span>
                <button
                  onClick={() => setEditandoBase(true)}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                  title="Editar base inicial"
                >
                  <Edit2 size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={baseInputValue}
                  onChange={(e) => setBaseInputValue(e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="0"
                />
                <button
                  onClick={handleSaveBaseInicial}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  title="Guardar"
                >
                  <Save size={18} />
                </button>
                <button
                  onClick={() => {
                    setEditandoBase(false);
                    setBaseInputValue(baseInicial.toString());
                  }}
                  className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  title="Cancelar"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Contenido del Reporte (Sección Imprimible) --- */}
      <div id="reporte-print">
        {loading && (
          <div className="text-center py-20">
            <p className="text-gray-600">Generando reporte...</p>
          </div>
        )}

        {!loading && !reportData && (
          <div className="text-center py-20 bg-white rounded-lg shadow-md">
            <p className="text-gray-600">Selecciona un rango de fechas y haz clic en "Generar Reporte".</p>
          </div>
        )}

        {reportData && (
          <div className="space-y-6">
            {/* Encabezado del reporte (solo visible al imprimir) */}
            <div className="hidden print:block border-b-2 border-gray-800 pb-3 mb-4">
              <h1 className="text-2xl font-bold text-gray-900">UNIFORMES MARTHA ROMERO</h1>
              <h2 className="text-xl font-semibold text-gray-700 mt-1">Reporte de Cierre de Caja</h2>
              <p className="text-sm text-gray-600 mt-2">
                Período: {startDate.toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })} - {endDate.toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-sm text-gray-600">
                Generado: {new Date().toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            {/* --- Resumen de Totales --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Wallet className="text-blue-600" size={32} />
                  <div>
                    <p className="text-sm text-blue-700 font-medium">Base Inicial</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatCurrency(baseInicial)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <ArrowUpCircle className="text-green-600" size={32} />
                  <div>
                    <p className="text-sm text-green-700 font-medium">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(reportData.totalIngresos)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-red-100 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <ArrowDownCircle className="text-red-600" size={32} />
                  <div>
                    <p className="text-sm text-red-700 font-medium">Total Egresos</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(reportData.totalEgresos)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <HandCoins className="text-orange-600" size={32} />
                  <div>
                    <p className="text-sm text-orange-700 font-medium">Retiros de Caja</p>
                    <p className="text-2xl font-bold text-orange-700">
                      {formatCurrency(reportData.totalRetiros)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-100 border border-blue-200 rounded-lg p-4" style={{backgroundColor: '#FFF1E5', borderColor: '#EA5C2E'}}>
                <div className="flex items-center gap-3">
                  <DollarSign className="text-orange-600" size={32} style={{color: '#EA5C2E'}} />
                  <div>
                    <p className="text-sm font-medium" style={{color: '#EA5C2E'}}>Saldo Neto</p>
                    <p className="text-2xl font-bold" style={{color: '#EA5C2E'}}>
                      {formatCurrency(reportData.saldoNeto)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="text-purple-600" size={32} />
                  <div>
                    <p className="text-sm text-purple-700 font-medium">Efectivo Esperado</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {formatCurrency(baseInicial + reportData.saldoNetoEfectivo - reportData.totalRetiros)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Desgloses --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Desglose por Método de Pago */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <Wallet size={20} className="text-pink-600" style={{color: '#D50565'}} />
                  <h2 className="text-lg font-semibold text-gray-800">Desglose por Método de Pago</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.keys(reportData.porMetodo).sort().map(metodo => (
                    <div key={metodo} className="p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">{metodo}</span>
                        <span className="font-bold text-gray-800">
                          {formatCurrency(reportData.porMetodo[metodo].total)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-green-600">Ingreso: {formatCurrency(reportData.porMetodo[metodo].ingresos)}</span>
                        <span className="text-red-600">Egreso: {formatCurrency(reportData.porMetodo[metodo].egresos)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desglose por Tipo de Transacción */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <BarChart2 size={20} className="text-orange-600" style={{color: '#EA5C2E'}} />
                  <h2 className="text-lg font-semibold text-gray-800">Desglose por Tipo</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.keys(reportData.porTipo).sort().map(tipo => (
                    <div key={tipo} className="p-3 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <span className="font-medium text-gray-700 capitalize">{tipo.replace('_', ' ')}</span>
                        <span className="text-sm text-gray-500 ml-2">({reportData.porTipo[tipo].count} trans.)</span>
                      </div>
                      <span className={`font-bold ${reportData.porTipo[tipo].total >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(reportData.porTipo[tipo].total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* --- Detalle de Retiros de Caja (si hay) --- */}
            {reportData.retirosCaja.length > 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2" style={{backgroundColor: '#FFF3E0'}}>
                  <HandCoins size={20} className="text-orange-600" />
                  <h2 className="text-lg font-semibold text-gray-800">Detalle de Retiros de Caja</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {reportData.retirosCaja.map((retiro, index) => (
                    <div key={index} className="p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium text-gray-700">{retiro.responsable}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            {retiro.fecha.toLocaleString('es-CO', {
                              month: 'numeric', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          {retiro.notas && (
                            <p className="text-xs text-gray-500 mt-1">{retiro.notas}</p>
                          )}
                        </div>
                        <span className="font-bold text-orange-600">
                          {formatCurrency(retiro.monto)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-orange-50 font-semibold">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800">Total Retirado:</span>
                      <span className="text-orange-700 text-lg">
                        {formatCurrency(reportData.totalRetiros)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Detalle de Egresos (si hay) --- */}
            {Object.keys(reportData.egresosPorCategoria).length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Egresos por Categoría */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-4 border-b flex items-center gap-2" style={{backgroundColor: '#FFF1F1'}}>
                    <ArrowDownCircle size={20} className="text-red-600" />
                    <h2 className="text-lg font-semibold text-gray-800">Egresos por Categoría</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.keys(reportData.egresosPorCategoria).sort().map(categoria => (
                      <div key={categoria} className="p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium text-gray-700">{categoria}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              ({reportData.egresosPorCategoria[categoria].count} {reportData.egresosPorCategoria[categoria].count === 1 ? 'egreso' : 'egresos'})
                            </span>
                          </div>
                          <span className="font-bold text-red-600">
                            ${reportData.egresosPorCategoria[categoria].total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 bg-red-50 font-semibold">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-800">Total Egresos:</span>
                        <span className="text-red-700 text-lg">
                          {formatCurrency(Math.abs(reportData.totalEgresos))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Egresos por Método de Pago */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-4 border-b flex items-center gap-2" style={{backgroundColor: '#FFF1F1'}}>
                    <Wallet size={20} className="text-red-600" />
                    <h2 className="text-lg font-semibold text-gray-800">Egresos por Método de Pago</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.keys(reportData.egresosPorMetodo).sort().map(metodo => (
                      <div key={metodo} className="p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">{metodo}</span>
                          <span className="font-bold text-red-600">
                            ${reportData.egresosPorMetodo[metodo].toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- Detalle de Transacciones --- */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800">Detalle de Transacciones ({reportData.transactions.length})</h2>
              </div>

              {/* Vista de Tarjetas - Solo Móvil */}
              <div className="md:hidden divide-y divide-gray-200">
                {reportData.transactions.map(t => (
                  <div key={t.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.monto >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {t.tipo.replace('_', ' ')}
                      </span>
                      <span className={`text-lg font-bold ${t.monto >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(t.monto)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      {t.tipo === 'egreso' && t.concepto ? t.concepto : t.descripcion}
                    </p>
                    {t.tipo === 'egreso' && t.categoria && (
                      <p className="text-xs text-gray-500 mb-1">Categoría: {t.categoria}</p>
                    )}
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>{t.metodoPago}</span>
                      <span>{t.fecha.toLocaleString('es-CO', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vista de Tabla - Solo Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha / Hora</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.transactions.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {t.fecha.toLocaleString('es-CO', {
                            year: 'numeric', month: 'numeric', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            t.monto >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {t.tipo.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div>
                            {t.tipo === 'egreso' && t.concepto ? t.concepto : t.descripcion}
                          </div>
                          {t.tipo === 'egreso' && t.categoria && (
                            <div className="text-xs text-gray-500 mt-1">
                              {t.categoria}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{t.metodoPago}</td>
                        <td className={`px-4 py-3 text-right font-medium ${t.monto >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(t.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* --- Modal de Retiro de Caja --- */}
      {showRetiroModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <HandCoins className="text-orange-600" size={28} />
                    Registrar Retiro de Caja
                  </h2>
                  <p className="text-gray-600 mt-1 text-sm">Por motivos de seguridad</p>
                </div>
                <button
                  onClick={() => setShowRetiroModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Monto */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto a Retirar <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={retiroMonto}
                  onChange={(e) => setRetiroMonto(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg"
                  placeholder="0"
                  min="0"
                  step="1000"
                />
              </div>

              {/* Responsable */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Retirado por <span className="text-red-500">*</span>
                </label>
                <select
                  value={retiroResponsable}
                  onChange={(e) => setRetiroResponsable(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Martha Romero">Martha Romero</option>
                  <option value="David Cortés">David Cortés</option>
                </select>
              </div>

              {/* Notas */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={retiroNotas}
                  onChange={(e) => setRetiroNotas(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows="3"
                  placeholder="Ej: Retiro por exceso de efectivo en caja"
                />
              </div>

              {/* Información */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-orange-800">
                  <strong>Nota:</strong> Este retiro se registrará como una salida de efectivo y afectará el cálculo del efectivo esperado en caja.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowRetiroModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarRetiro}
                disabled={loading}
                className="flex-1 px-4 py-3 text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                style={{ backgroundColor: '#EA5C2E' }}
              >
                {loading ? 'Registrando...' : 'Registrar Retiro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Estilos de Impresión --- */}
      <style>{`
        @media print {
          /* Configuración de página tamaño carta */
          @page {
            size: letter;
            margin: 0.5in;
          }

          /* Ocultar todo excepto el reporte */
          body * {
            visibility: hidden;
          }

          #reporte-print,
          #reporte-print * {
            visibility: visible;
          }

          #reporte-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }

          .print\\:hidden {
            display: none !important;
          }

          /* Mostrar elementos con print:block */
          .print\\:block {
            display: block !important;
          }

          /* Reducir tamaños de fuente */
          #reporte-print {
            font-size: 10px;
          }

          #reporte-print h2 {
            font-size: 12px;
            margin-bottom: 8px;
          }

          #reporte-print .text-2xl {
            font-size: 16px !important;
          }

          #reporte-print .text-xl {
            font-size: 14px !important;
          }

          #reporte-print .text-lg {
            font-size: 12px !important;
          }

          #reporte-print .text-base {
            font-size: 10px !important;
          }

          #reporte-print .text-sm {
            font-size: 9px !important;
          }

          #reporte-print .text-xs {
            font-size: 8px !important;
          }

          /* Reducir espaciados */
          #reporte-print .p-4 {
            padding: 8px !important;
          }

          #reporte-print .p-3 {
            padding: 6px !important;
          }

          #reporte-print .gap-4 {
            gap: 8px !important;
          }

          #reporte-print .gap-6 {
            gap: 12px !important;
          }

          #reporte-print .space-y-6 > * + * {
            margin-top: 12px !important;
          }

          /* Ajustar íconos */
          #reporte-print svg {
            width: 20px !important;
            height: 20px !important;
          }

          /* Tablas más compactas */
          #reporte-print table {
            font-size: 8px;
          }

          #reporte-print th,
          #reporte-print td {
            padding: 4px 8px !important;
          }

          /* Evitar saltos de página dentro de elementos */
          #reporte-print .bg-white {
            page-break-inside: avoid;
          }

          /* Forzar layout de grid a 1 columna en secciones específicas */
          #reporte-print .grid.lg\\:grid-cols-2 {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          /* Asegurar que las tarjetas de resumen quepan */
          #reporte-print .grid.md\\:grid-cols-3 {
            grid-template-columns: repeat(3, 1fr) !important;
          }

          #reporte-print .grid.lg\\:grid-cols-6 {
            grid-template-columns: repeat(3, 1fr) !important;
          }

          /* Limitar altura de la tabla de transacciones */
          #reporte-print .overflow-x-auto {
            max-height: 250px;
            overflow-y: auto;
          }

          /* Ajustar bordes y sombras para impresión */
          #reporte-print .shadow-md {
            box-shadow: none !important;
            border: 1px solid #e5e7eb;
          }

          #reporte-print .rounded-lg {
            border-radius: 4px !important;
          }

          /* Reducir márgenes entre secciones */
          #reporte-print .mb-6 {
            margin-bottom: 8px !important;
          }

          #reporte-print .mb-4 {
            margin-bottom: 6px !important;
          }

          #reporte-print .mt-4 {
            margin-top: 6px !important;
          }

          /* Hacer las tarjetas de resumen más compactas */
          #reporte-print .grid.md\\:grid-cols-3 .border {
            padding: 6px !important;
          }

          /* Optimizar el espacio del encabezado */
          #reporte-print .border-b-2 {
            padding-bottom: 8px !important;
            margin-bottom: 12px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CierreCaja; // <--- Export cambiado
