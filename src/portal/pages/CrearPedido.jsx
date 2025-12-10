import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../context/PortalAuthContext';
import { useCart } from '../context/CartContext';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
      // Crear el pedido en Firestore
      const pedidoData = {
        clienteId: clienteCorporativo.id,
        clienteNombre: clienteCorporativo.nombre,
        codigoColegio: clienteCorporativo.codigoColegio,
        productos: cartItems.map(item => ({
          productoId: item.id,
          codigo: item.codigo,
          descripcion: item.descripcion,
          talla: item.talla,
          cantidad: item.cantidad,
          precioUnitario: item.precio,
          subtotal: item.precio * item.cantidad,
          tipo: item.tipo || '',
          categoria: item.categoria || ''
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
        mensaje: `${clienteCorporativo.nombre} ha creado un pedido por ${formatCurrency(getTotalPrice())}`,
        leida: false,
        pedidoId: pedidoRef.id,
        clienteNombre: clienteCorporativo.nombre,
        createdAt: serverTimestamp()
      });

      // Limpiar el carrito
      clearCart();

      // Mostrar mensaje de éxito
      alert('¡Pedido creado exitosamente! El administrador será notificado.');

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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            El carrito está vacío
          </h2>
          <p className="text-gray-500 mb-6">
            Agrega productos desde el catálogo para crear un pedido
          </p>
          <button
            onClick={() => navigate('/portal/catalogo')}
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-colors"
            style={{ backgroundColor: '#D50565' }}
          >
            <Package size={20} />
            Ir al Catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/portal/catalogo')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Crear Nuevo Pedido
          </h1>
          <p className="text-gray-600">
            {clienteCorporativo?.nombre}
          </p>
        </div>
      </div>

      {/* Resumen del Pedido */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ShoppingBag size={24} />
          Resumen del Pedido
        </h2>

        {/* Lista de Productos */}
        <div className="space-y-3 mb-6">
          {cartItems.map((item, index) => (
            <div
              key={`${item.id}-${item.talla}`}
              className={`flex justify-between items-center p-4 rounded-lg ${
                index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
              } border border-gray-200`}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">
                  {item.descripcion}
                </h3>
                <p className="text-sm text-gray-500">
                  Talla: {item.talla} • Cantidad: {item.cantidad}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">
                  {formatCurrency(item.precio * item.cantidad)}
                </p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(item.precio)} c/u
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-gray-700">Total:</span>
            <span className="text-3xl font-bold" style={{ color: '#D50565' }}>
              {formatCurrency(getTotalPrice())}
            </span>
          </div>
        </div>
      </div>

      {/* Notas del Pedido */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Notas del Pedido (Opcional)
        </h2>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Agrega cualquier nota o instrucción especial para este pedido..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
          rows={4}
        />
      </div>

      {/* Botones de Acción */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/portal/catalogo')}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleCrearPedido}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#D50565' }}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Creando...
            </>
          ) : (
            <>
              <Send size={20} />
              Confirmar Pedido
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CrearPedido;
