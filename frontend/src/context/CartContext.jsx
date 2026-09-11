import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../api';
import { useAuth } from './AuthContext';

const CartContext = createContext();

// The server caps each cart line at 10 units
const MAX_QTY = 10;

const readGuestCart = () => {
  try {
    const local = JSON.parse(localStorage.getItem('guest_cart') || '[]');
    return Array.isArray(local) ? local : [];
  } catch (e) {
    return [];
  }
};

const buildCart = (items) => ({
  items,
  total_amount: items.reduce((sum, i) => sum + API.toNumber(i.price) * i.quantity, 0)
});

export const CartProvider = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const [cart, setCart] = useState({ items: [], total_amount: 0 });
  const [wishlist, setWishlist] = useState([]);
  const [settings, setSettings] = useState({});

  const fetchCart = async () => {
    if (isLoggedIn) {
      try {
        // GET /cart returns a plain array of line items
        const data = await API.request('/cart');
        const items = (Array.isArray(data) ? data : []).map((item) => ({
          ...item,
          price: API.toNumber(item.price),
          image_url: item.image_url || item.image || ''
        }));
        setCart(buildCart(items));
      } catch (e) {
        console.error('Failed to fetch cart', e);
      }
    } else {
      setCart(buildCart(readGuestCart()));
    }
  };

  const fetchWishlist = async () => {
    if (isLoggedIn) {
      try {
        const data = await API.request('/wishlist');
        setWishlist(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch wishlist', e);
      }
    } else {
      setWishlist([]);
    }
  };

  // Move items added while logged out into the account cart
  const syncGuestCart = async () => {
    const local = readGuestCart();
    if (local.length === 0) return;
    // Claim the guest cart first so an overlapping run (e.g. StrictMode's double effect) can't sync it twice
    localStorage.removeItem('guest_cart');
    try {
      await API.request('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ localCart: local.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })) })
      });
    } catch (e) {
      localStorage.setItem('guest_cart', JSON.stringify(local));
      console.error('Failed to sync guest cart', e);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (isLoggedIn) await syncGuestCart();
      await Promise.all([fetchCart(), fetchWishlist()]);
    };
    load();
  }, [isLoggedIn]);

  // Public store settings drive the shipping shown in cart & checkout
  useEffect(() => {
    API.request('/settings')
      .then((data) => setSettings(data || {}))
      .catch(() => setSettings({}));
  }, []);

  // POST /cart sets the absolute quantity of a line (0 removes it)
  const setServerQuantity = (variantId, quantity) =>
    API.request('/cart', {
      method: 'POST',
      body: JSON.stringify({ variant_id: variantId, quantity })
    });

  const addToCart = async (variantId, quantity = 1, productDetails = null) => {
    if (!variantId) {
      API.showToast('This product is currently unavailable', 'danger');
      return;
    }

    const existing = (cart.items || []).find((i) => i.variant_id === variantId);
    if (existing && existing.quantity >= MAX_QTY) {
      API.showToast(`You can add up to ${MAX_QTY} units of an item`, 'info');
      return;
    }

    if (isLoggedIn) {
      try {
        const newQty = Math.min((existing?.quantity || 0) + quantity, MAX_QTY);
        const res = await setServerQuantity(variantId, newQty);
        await fetchCart();
        if (res?.capped) {
          API.showToast(`Only ${res.quantity} in stock - cart updated`, 'info');
        } else {
          API.showToast('Item added to cart!', 'success');
        }
      } catch (err) {
        API.showToast(err.message || 'Failed to add item to cart', 'danger');
      }
    } else {
      const local = readGuestCart();
      const existingIdx = local.findIndex((i) => i.variant_id === variantId);
      if (existingIdx > -1) {
        local[existingIdx].quantity = Math.min(local[existingIdx].quantity + quantity, MAX_QTY);
      } else if (productDetails) {
        local.push({
          variant_id: variantId,
          quantity: Math.min(quantity, MAX_QTY),
          product_name: productDetails.name,
          weight_value: productDetails.weight_value,
          weight_unit: productDetails.weight_unit,
          price: API.toNumber(productDetails.price),
          image_url: productDetails.image_url
        });
      } else {
        API.showToast('Failed to add item to cart', 'danger');
        return;
      }
      localStorage.setItem('guest_cart', JSON.stringify(local));
      fetchCart();
      API.showToast('Item added to cart!', 'success');
    }
  };

  // cartItemId is kept for existing callers; cart lines are keyed by variant
  const updateQuantity = async (cartItemId, newQty, variantId) => {
    if (newQty < 1) return removeFromCart(cartItemId, variantId);
    if (newQty > MAX_QTY) {
      API.showToast(`You can add up to ${MAX_QTY} units of an item`, 'info');
      return;
    }

    if (isLoggedIn) {
      try {
        const res = await setServerQuantity(variantId, newQty);
        if (res?.capped) API.showToast(`Only ${res.quantity} in stock`, 'info');
        fetchCart();
      } catch (err) {
        API.showToast(err.message, 'danger');
      }
    } else {
      const local = readGuestCart();
      const item = local.find((i) => i.variant_id === variantId);
      if (item) {
        item.quantity = newQty;
        localStorage.setItem('guest_cart', JSON.stringify(local));
        fetchCart();
      }
    }
  };

  const removeFromCart = async (cartItemId, variantId) => {
    if (isLoggedIn) {
      try {
        await setServerQuantity(variantId, 0);
        fetchCart();
        API.showToast('Item removed from cart', 'info');
      } catch (err) {
        API.showToast(err.message, 'danger');
      }
    } else {
      const local = readGuestCart().filter((i) => i.variant_id !== variantId);
      localStorage.setItem('guest_cart', JSON.stringify(local));
      fetchCart();
      API.showToast('Item removed from cart', 'info');
    }
  };

  const toggleWishlist = async (productId) => {
    if (!isLoggedIn) {
      API.showToast('Please login to save items to wishlist', 'info');
      return;
    }
    try {
      const res = await API.request('/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId })
      });
      await fetchWishlist();
      API.showToast(res.message, 'success');
    } catch (err) {
      API.showToast(err.message, 'danger');
    }
  };

  const isInWishlist = (productId) => {
    return wishlist.some((w) => Number(w.product_id) === Number(productId));
  };

  // Empty the cart in the UI straight away (e.g. after an order); the server clears it as part of the order
  const clearCart = () => {
    if (!isLoggedIn) localStorage.removeItem('guest_cart');
    setCart(buildCart([]));
  };

  const cartCount = (cart.items || []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, cartCount, wishlist, settings, addToCart, updateQuantity, removeFromCart, clearCart, toggleWishlist, isInWishlist, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
