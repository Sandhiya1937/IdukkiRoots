import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { API } from '../api';

export const CartPage = () => {
  const { cart, updateQuantity, removeFromCart, settings } = useCart();
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState(() => sessionStorage.getItem(API.COUPON_KEY) || '');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const items = cart.items || [];
  const subtotal = items.reduce((sum, item) => sum + API.toNumber(item.price) * item.quantity, 0);
  const shipping = API.calcShipping(subtotal, settings);
  const finalTotal = Math.max(0, subtotal - discountAmount + shipping);

  const clearCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    sessionStorage.removeItem(API.COUPON_KEY);
  };

  const applyCoupon = async (code, { silent = false } = {}) => {
    try {
      const res = await API.request('/orders/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({ coupon_code: code, subtotal })
      });
      setAppliedCoupon(res);
      setDiscountAmount(res.discount_amount);
      // Checkout picks the coupon up from here and re-validates it
      sessionStorage.setItem(API.COUPON_KEY, res.code);
      if (!silent) API.showToast(`Coupon "${res.code}" applied! Saved ${API.formatCurrency(res.discount_amount)}`, 'success');
    } catch (err) {
      clearCoupon();
      API.showToast(silent ? `Coupon removed: ${err.message}` : err.message || 'Invalid coupon code', silent ? 'info' : 'danger');
    }
  };

  // Keep the discount in step with the cart (minimum order value, percentage caps)
  useEffect(() => {
    const saved = sessionStorage.getItem(API.COUPON_KEY);
    if (saved && subtotal > 0) applyCoupon(saved, { silent: true });
  }, [subtotal]);

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    applyCoupon(couponCode.trim());
  };

  return (
    <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <h2 style={{ fontSize: '1.6rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>
        Shopping Cart ({items.length} items)
      </h2>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <i className="fas fa-shopping-basket" style={{ fontSize: '3.5rem', color: 'var(--text-light)', marginBottom: '1rem' }}></i>
          <h3 style={{ color: 'var(--secondary)' }}>Your Cart is Empty</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>Looks like you haven't added any spices yet.</p>
          <Link to="/products" className="btn btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="cart-layout">
          {/* Cart Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map((item) => (
              <div
                key={item.variant_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  background: 'var(--bg-surface)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <img
                  src={item.image_url || '/uploads/placeholder.jpg'}
                  alt={item.product_name}
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />

                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--secondary)' }}>{item.product_name}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Weight: {API.formatWeight(item.weight_value, item.weight_unit) || item.variant_details}
                  </span>
                  <div style={{ fontWeight: 800, color: 'var(--primary)', marginTop: '0.3rem' }}>
                    {API.formatCurrency(item.price)}
                  </div>
                </div>

                {/* Qty Controls */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant_id)} style={{ padding: '0.3rem 0.6rem', border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', fontWeight: 700 }}>-</button>
                  <span style={{ padding: '0.3rem 0.8rem', fontWeight: 700 }}>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant_id)} style={{ padding: '0.3rem 0.6rem', border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>

                <div style={{ fontWeight: 800, minWidth: '90px', textAlign: 'right' }}>
                  {API.formatCurrency(API.toNumber(item.price) * item.quantity)}
                </div>

                <button
                  onClick={() => removeFromCart(item.id, item.variant_id)}
                  style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.1rem', padding: '0.4rem' }}
                >
                  <i className="far fa-trash-alt"></i>
                </button>
              </div>
            ))}
          </div>

          {/* Order Summary & Coupon */}
          <div className="summary-card">
            <h3 style={{ fontSize: '1.15rem', color: 'var(--secondary)', marginBottom: '1rem' }}>Order Summary</h3>

            {/* Coupon Form */}
            <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="text"
                placeholder="Enter Promo Code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="search-input"
                style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem', flex: 1, textTransform: 'uppercase' }}
              />
              <button type="submit" className="btn btn-outline btn-sm">Apply</button>
            </form>

            {appliedCoupon && (
              <div style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Coupon ({appliedCoupon.code})</span>
                <span>
                  - {API.formatCurrency(discountAmount)}
                  <button
                    type="button"
                    onClick={() => { clearCoupon(); setCouponCode(''); }}
                    style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: '0.5rem' }}
                    title="Remove coupon"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span>{API.formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shipping</span>
                <span>{shipping === 0 ? <strong style={{ color: 'var(--success)' }}>FREE</strong> : API.formatCurrency(shipping)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                  <span>Discount</span>
                  <span>- {API.formatCurrency(discountAmount)}</span>
                </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, color: 'var(--secondary)' }}>
                <span>Total</span>
                <span>{API.formatCurrency(finalTotal)}</span>
              </div>
            </div>

            <button onClick={() => navigate('/checkout')} className="btn btn-primary" style={{ width: '100%', height: '44px', marginTop: '1.5rem' }}>
              Proceed to Checkout <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
