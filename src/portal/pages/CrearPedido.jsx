import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../context/PortalAuthContext';
import { useCart } from '../context/CartContext';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { ShoppingBag, Package, ArrowLeft, Send } from 'lucide-react';

const CrearPedido = () => {
  const navigate = useNavigate();
  const { clienteCorporativo } = usePortalAuth();
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleCrearPedido = async () => {
    if (cartItems.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    if (!window.confirm('¿Confirmar la creación de este pedido?')) {
      return;
    }

    setLoading(true);
    try {
      // Obtener el número de pedido consecutivo
      const q = query(collection(db, 'pedidos_b2b'), orderBy('numeroPedido', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      let nextNumero = 1;
      if (!snapshot.empty) {
        const lastPedido = snapshot.docs[0].data();
        nextNumero = (lastPedido.numeroPedido || 0) + 1;
      }

      // Crear el pedido en Firestore
      const pedidoData = {
        numeroPedido: nextNumero,
        clienteId: clienteCorporativo?.id || '',
        clienteNombre: clienteCorporativo?.nombre || '',
        codigoColegio: clienteCorporativo?.codigoColegio || '',
        productos: cartItems.map(item => ({
          productoId: item.id || '',
          codigo: item.codigo || '',
          descripcion: item.descripcion || '',
          talla: item.talla || '',
          cantidad: item.cantidad || 0,
          precioUnitario: item.precio || 0,
          subtotal: (item.precio || 0) * (item.cantidad || 0),
          tipo: item.tipo || '',
          categoria: item.categoria || '',
          // Control de producción y envío
          cantidadAlistada: 0,
          cantidadAlistadaActual: 0,
          cantidadAlistadaTotal: 0,
          cantidadEnviada: 0,
          cantidadRecibida: 0,
          estadoProduccion: 'pendiente',
          fechaAlistado: null,
          fechaEnvio: null,
          fechaRecepcion: null,
          historialEnvios: []
        })),
        total: getTotalPrice(),
        notas: notas.trim(),
        estado: 'Pendiente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const pedidoRef = await addDoc(collection(db, 'pedidos_b2b'), pedidoData);

      // Crear notificación para administradores
      await addDoc(collection(db, 'notificaciones_admin'), {
        tipo: 'nuevo_pedido_b2b',
        titulo: 'Nuevo Pedido B2B',
        mensaje: `${clienteCorporativo?.nombre || 'Cliente'} ha creado el pedido #${String(nextNumero).padStart(4, '0')} por ${formatCurrency(getTotalPrice())}`,
        leida: false,
        pedidoId: pedidoRef.id || '',
        numeroPedido: nextNumero,
        clienteNombre: clienteCorporativo?.nombre || '',
        createdAt: serverTimestamp()
      });

      // Limpiar el carrito
      clearCart();

      // Mostrar mensaje de éxito
      alert(`¡Pedido #${String(nextNumero).padStart(4, '0')} creado exitosamente! El administrador será notificado.`);

      // Redirigir a Mis Pedidos
      navigate('/portal/mis-pedidos');
    } catch (error) {
      console.error('Error al crear pedido:', error);
      alert('Error al crear el pedido: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-8 md:p-12 text-center">
          <ShoppingBag size={48} className="md:w-16 md:h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl md:text-2xl font-bold text-gray-700 mb-2">
            El carrito está vacío
          </h2>
          <p className="text-sm md:text-base text-gray-500 mb-6">
            Agrega productos desde el catálogo para crear un pedido
          </p>
          <button
            onClick={() => navigate('/portal/catalogo')}
            className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 text-sm md:text-base text-white rounded-lg hover:opacity-90 transition-colors"
            style={{ backgroundColor: '#D50565' }}
          >
            <Package size={18} className="md:w-5 md:h-5" />
            Ir al Catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={() => navigate('/portal/catalogo')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">
            Crear Nuevo Pedido
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            {clienteCorporativo?.nombre}
          </p>
        </div>
      </div>

      {/* Resumen del Pedido */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ShoppingBag size={20} className="md:w-6 md:h-6" />
          Resumen del Pedido
        </h2>

        {/* Lista de Productos */}
        <div className="space-y-3 mb-6">
          {cartItems.map((item, index) => (
            <div
              key={`${item.id}-${item.talla}`}
              className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-3 md:p-4 rounded-lg ${
                index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
              } border border-gray-200`}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 text-sm md:text-base">
                  {item.descripcion}
                </h3>
                <p className="text-xs md:text-sm text-gray-500 mt-1">
                  Talla: {item.talla} • Cantidad: {item.cantidad}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-bold text-gray-800 text-sm md:text-base">
                  {formatCurrency(item.precio * item.cantidad)}
                </p>
                <p className="text-xs md:text-sm text-gray-500">
                  {formatCurrency(item.precio)} c/u
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg md:text-xl font-bold text-gray-700">Total:</span>
            <span className="text-2xl md:text-3xl font-bold" style={{ color: '#D50565' }}>
              {formatCurrency(getTotalPrice())}
            </span>
          </div>
        </div>
      </div>

      {/* Notas del Pedido */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">
          Notas del Pedido (Opcional)
        </h2>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Agrega cualquier nota o instrucción especial para este pedido..."
          className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
          rows={4}
        />
      </div>

      {/* Botones de Acción */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pb-6">
        <button
          onClick={() => navigate('/portal/catalogo')}
          className="w-full sm:flex-1 px-4 md:px-6 py-2 md:py-3 text-sm md:text-base bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleCrearPedido}
          disabled={loading}
          className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 text-sm md:text-base text-white font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#D50565' }}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white"></div>
              Creando...
            </>
          ) : (
            <>
              <Send size={18} className="md:w-5 md:h-5" />
              Confirmar Pedido
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CrearPedido;
