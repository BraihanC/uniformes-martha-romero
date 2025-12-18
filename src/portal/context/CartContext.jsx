import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext({});

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const savedCart = localStorage.getItem('b2b_cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error al cargar carrito:', error);
      }
    }
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('b2b_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // Agregar producto al carrito
  const addToCart = (producto, cantidad = 1) => {
    setCartItems(prevItems => {
      // Verificar si el producto ya existe en el carrito
      const existingItemIndex = prevItems.findIndex(
        item => item.id === producto.id && item.talla === producto.talla
      );

      if (existingItemIndex >= 0) {
        // Si existe, actualizar cantidad
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          cantidad: updatedItems[existingItemIndex].cantidad + cantidad
        };
        return updatedItems;
      } else {
        // Si no existe, agregar nuevo item
        return [...prevItems, {
          id: producto.id || '',
          codigo: producto.codigo || '',
          descripcion: producto.descripcion || '',
          talla: producto.talla || '',
          precio: producto.precio || 0,
          cantidad: cantidad || 0,
          tipo: producto.tipo || '',
          categoria: producto.categoria || ''
        }];
      }
    });
  };

  // Actualizar cantidad de un item
  const updateQuantity = (itemId, talla, newCantidad) => {
    if (newCantidad <= 0) {
      removeFromCart(itemId, talla);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId && item.talla === talla
          ? { ...item, cantidad: newCantidad }
          : item
      )
    );
  };

  // Eliminar producto del carrito
  const removeFromCart = (itemId, talla) => {
    setCartItems(prevItems =>
      prevItems.filter(item => !(item.id === itemId && item.talla === talla))
    );
  };

  // Limpiar todo el carrito
  const clearCart = () => {
    setCartItems([]);
  };

  // Calcular total de items
  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.cantidad, 0);
  };

  // Calcular total en dinero
  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.precio * item.cantidad), 0);
  };

  const value = {
    cartItems,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalItems,
    getTotalPrice
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
