import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ShoppingCart, X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';

const FloatingCart = () => {
  const navigate = useNavigate();
  const { cartItems, getTotalItems, getTotalPrice, updateQuantity, removeFromCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleCrearPedido = () => {
    setIsOpen(false);
    navigate('/portal/crear-pedido');
  };

  const totalItems = getTotalItems();

  return (
    <>
      {/* Botón Flotante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 text-white rounded-full shadow-lg p-4 hover:opacity-90 transition-all z-40"
        style={{ backgroundColor: '#D50565' }}
      >
        <ShoppingCart size={24} />
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
            {totalItems}
          </span>
        )}
      </button>

      {/* Modal del Carrito */}
      {isOpen && (
        <>
          {/* Overlay - Ligeramente oscuro */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel del Carrito */}
          <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: '#D50565' }}>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingBag size={24} />
                Mi Carrito
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Contenido del Carrito */}
            {cartItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <ShoppingCart size={64} className="text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg font-medium">Tu carrito está vacío</p>
                <p className="text-gray-400 text-sm mt-2">Agrega productos desde el catálogo</p>
              </div>
            ) : (
              <>
                {/* Lista de Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={`${item.id}-${item.talla}`}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 text-sm">
                            {item.descripcion}
                          </h3>
                          <p className="text-xs text-gray-500">
                            Talla: {item.talla}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id, item.talla)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Control de Cantidad */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.talla, item.cantidad - 1)}
                            className="bg-gray-200 hover:bg-gray-300 rounded-full p-1"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-medium w-8 text-center">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.talla, item.cantidad + 1)}
                            className="bg-gray-200 hover:bg-gray-300 rounded-full p-1"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Precio */}
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: '#D50565' }}>
                            {formatCurrency(item.precio * item.cantidad)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(item.precio)} c/u
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer con Total y Botón */}
                <div className="border-t p-4 space-y-4 bg-gray-50">
                  {/* Total */}
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-700">Total:</span>
                    <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                      {formatCurrency(getTotalPrice())}
                    </span>
                  </div>

                  {/* Resumen */}
                  <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                    <p>
                      {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'} en el carrito
                    </p>
                  </div>

                  {/* Botón Crear Pedido */}
                  <button
                    onClick={handleCrearPedido}
                    className="w-full text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-colors"
                    style={{ backgroundColor: '#D50565' }}
                  >
                    Crear Pedido
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default FloatingCart;
