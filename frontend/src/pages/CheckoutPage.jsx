import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { API } from '../api';

const emptyAddress = { full_name: '', phone: '', address_line1: '', city: '', state: 'Kerala', postal_code: '', is_default: true };
const inputStyle = { border: '1px solid var(--border-color)', padding: '0.6rem' };
const linkButton = { border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0 };

const PAYMENT_OPTIONS = {
  cod: { title: 'Cash on Delivery (COD)', note: 'Pay in cash when your order is delivered' },
  upi: { title: 'UPI (PhonePe / Google Pay / Paytm / BHIM)', note: 'Scan a QR code and pay right after you place the order' }
};

const formatAddress = (a) =>
  `${a.full_name}, ${a.address_line1}${a.address_line2 ? `, ${a.address_line2}` : ''}, ${a.city}, ${a.state} - ${a.postal_code}`;

// One numbered checkout step; once completed it collapses to a summary line with a "Change" link
const Step = ({ number, title, active, summary, onChange, children }) => (
  <section style={{ background: 'var(--bg-surface)', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-md)', border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`, marginBottom: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.9rem' }}>
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: active ? 'var(--primary)' : 'var(--secondary)' }}>{number}</span>
        <div>
          <h3 style={{ fontSize: '1.05rem', color: active ? 'var(--primary)' : 'var(--secondary)' }}>{title}</h3>
          {!active && summary && <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.5 }}>{summary}</div>}
        </div>
      </div>
      {!active && summary && onChange && <button type="button" onClick={onChange} style={linkButton}>Change</button>}
    </div>
    {active && <div style={{ marginTop: '1rem', paddingLeft: '1.75rem' }}>{children}</div>}
  </section>
);

export const CheckoutPage = () => {
  const { cart, fetchCart, clearCart, settings } = useCart();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('address'); // address -> payment -> review
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddr, setNewAddr] = useState(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [coupon, setCoupon] = useState(null);

  const items = cart.items || [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + API.toNumber(item.price) * item.quantity, 0);
  const shipping = API.calcShipping(subtotal, settings);
  const discount = coupon ? API.toNumber(coupon.discount_amount) : 0;
  const finalTotal = Math.max(0, subtotal + shipping - discount);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/register', { state: { from: '/checkout' } });
      return;
    }
    API.request('/auth/addresses')
      .then((data) => {
        setAddresses(data);
        const preferred = data.find((a) => a.is_default) || data[0];
        if (preferred) {
          // A saved address is pre-selected, so start at the payment step
          setSelectedAddressId(preferred.id);
          setStep('payment');
        } else {
          setShowAddressForm(true);
        }
      })
      .catch(() => setAddresses([]));
  }, [isLoggedIn]);

  // Re-check the coupon applied on the cart page against the current subtotal
  useEffect(() => {
    const code = sessionStorage.getItem(API.COUPON_KEY);
    if (!code || subtotal <= 0) {
      setCoupon(null);
      return;
    }
    API.request('/orders/validate-coupon', {
      method: 'POST',
      body: JSON.stringify({ coupon_code: code, subtotal })
    })
      .then(setCoupon)
      .catch(() => {
        setCoupon(null);
        sessionStorage.removeItem(API.COUPON_KEY);
      });
  }, [subtotal]);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      const added = await API.request('/auth/addresses', {
        method: 'POST',
        body: JSON.stringify(newAddr)
      });
      const updated = await API.request('/auth/addresses');
      setAddresses(updated);
      setSelectedAddressId(added.id);
      setShowAddressForm(false);
      setNewAddr(emptyAddress);
      setStep('payment');
      API.showToast('Address saved', 'success');
    } catch (err) {
      API.showToast(err.message || 'Failed to save address', 'danger');
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setStep('address');
      API.showToast('Please choose a delivery address', 'warning');
      return;
    }

    setPlacingOrder(true);
    try {
      // Field names and values match POST /api/orders in src/routes/orders.js
      const order = await API.request('/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
          address_id: selectedAddress.id,
          payment_method: paymentMethod.toUpperCase(),
          coupon_code: coupon?.code || null
        })
      });

      sessionStorage.removeItem(API.COUPON_KEY);
      // replace: the back button must not return to a checkout for an order that already exists
      if (paymentMethod === 'upi') {
        API.showToast(`Order ${order.order_number} placed. Complete your UPI payment to confirm it.`, 'success');
        navigate(`/order/${order.order_id}/payment`, { replace: true });
      } else {
        navigate(`/order/${order.order_id}`, { replace: true, state: { justPlaced: true } });
      }
      // The server emptied the cart with the order; reflect it in the header immediately
      clearCart();
      fetchCart();
    } catch (err) {
      API.showToast(err.message || 'Failed to place order', 'danger');
      setPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem' }}>
        <h2>Your Cart is Empty</h2>
        <button onClick={() => navigate('/products')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Return to Shop</button>
      </div>
    );
  }

  const canPlaceOrder = !!selectedAddress && step === 'review' && !placingOrder;
  const placeLabel = placingOrder
    ? 'Placing your order...'
    : paymentMethod === 'upi' ? `Place Order & Pay ${API.formatCurrency(finalTotal)}` : 'Place Your Order';

  return (
    <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <h2 style={{ fontSize: '1.6rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>Checkout ({itemCount} {itemCount === 1 ? 'item' : 'items'})</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '2rem', alignItems: 'start' }}>
        <div>
          {/* Step 1: address */}
          <Step
            number={1}
            title="Delivery address"
            active={step === 'address'}
            summary={selectedAddress && <>{formatAddress(selectedAddress)}<br />Phone: {selectedAddress.phone}</>}
            onChange={() => setStep('address')}
          >
            {addresses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.9rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${selectedAddressId === addr.id ? 'var(--primary)' : 'var(--border-color)'}`,
                      background: selectedAddressId === addr.id ? 'var(--primary-light)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="addr"
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                      style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }}
                    />
                    <div style={{ fontSize: '0.9rem' }}>
                      <strong>{addr.full_name}</strong> ({addr.phone})<br />
                      <span style={{ color: 'var(--text-muted)' }}>{addr.address_line1}, {addr.city}, {addr.state} - {addr.postal_code}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {showAddressForm ? (
              <form onSubmit={handleAddAddress} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '520px' }}>
                <strong style={{ fontSize: '0.95rem' }}>Add a new address</strong>
                <input type="text" placeholder="Full Name *" required value={newAddr.full_name} onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })} className="search-input" style={inputStyle} />
                <input type="tel" placeholder="Phone Number *" required value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} className="search-input" style={inputStyle} />
                <input type="text" placeholder="Address Line (House/Street) *" required value={newAddr.address_line1} onChange={(e) => setNewAddr({ ...newAddr, address_line1: e.target.value })} className="search-input" style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <input type="text" placeholder="City *" required value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="search-input" style={inputStyle} />
                  <input type="text" placeholder="State *" required value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} className="search-input" style={inputStyle} />
                  <input type="text" placeholder="Pincode *" required value={newAddr.postal_code} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} className="search-input" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary btn-sm">Save and deliver here</button>
                  {addresses.length > 0 && <button type="button" onClick={() => setShowAddressForm(false)} className="btn btn-outline btn-sm">Cancel</button>}
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => selectedAddress && setStep('payment')} disabled={!selectedAddress} className="btn btn-primary btn-sm">
                  Deliver to this address
                </button>
                <button type="button" onClick={() => setShowAddressForm(true)} style={linkButton}>
                  <i className="fas fa-plus"></i> Add a new address
                </button>
              </div>
            )}
          </Step>

          {/* Step 2: payment */}
          <Step
            number={2}
            title="Payment method"
            active={step === 'payment'}
            summary={step === 'review' ? PAYMENT_OPTIONS[paymentMethod].title : null}
            onChange={() => setStep('payment')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(PAYMENT_OPTIONS).map(([value, option]) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.9rem 1rem',
                    border: `1.5px solid ${paymentMethod === value ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: paymentMethod === value ? 'var(--primary-light)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                >
                  <input type="radio" name="pay" value={value} checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} style={{ accentColor: 'var(--primary)' }} />
                  <div><strong>{option.title}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{option.note}</small></div>
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setStep('review')} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
              Use this payment method
            </button>
          </Step>

          {/* Step 3: review */}
          <Step number={3} title="Review items and delivery" active={step === 'review'}>
            {selectedAddress && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                <i className="fas fa-truck" style={{ color: 'var(--primary)' }}></i> Delivering to <strong>{selectedAddress.full_name}</strong>, {selectedAddress.city} - {selectedAddress.postal_code}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((i) => (
                <div key={i.variant_id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <img src={i.image_url || '/uploads/placeholder.jpg'} alt={i.product_name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  <div style={{ flex: 1, fontSize: '0.9rem' }}>
                    <strong>{i.product_name}</strong><br />
                    <span style={{ color: 'var(--text-muted)' }}>{API.formatWeight(i.weight_value, i.weight_unit) || i.variant_details} · Qty {i.quantity}</span>
                  </div>
                  <strong>{API.formatCurrency(API.toNumber(i.price) * i.quantity)}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.25rem' }}>
              <button onClick={handlePlaceOrder} disabled={!canPlaceOrder} className="btn btn-primary" style={{ height: '44px', padding: '0 1.5rem' }}>
                {placeLabel}
              </button>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--secondary)' }}>Order Total: {API.formatCurrency(finalTotal)}</div>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {paymentMethod === 'upi'
                ? 'After placing the order you will see the UPI QR code to complete the payment.'
                : 'You will pay in cash when the order is delivered.'}{' '}
              <Link to="/cart" style={{ color: 'var(--primary)', fontWeight: 600 }}>Edit cart</Link>
            </div>
          </Step>
        </div>

        {/* Order summary */}
        <div className="summary-card" style={{ position: 'sticky', top: '1rem' }}>
          <button data-testid="place-order" onClick={handlePlaceOrder} disabled={!canPlaceOrder} className="btn btn-primary" style={{ width: '100%', height: '46px', opacity: canPlaceOrder || placingOrder ? 1 : 0.6 }}>
            {placeLabel}
          </button>
          {!canPlaceOrder && !placingOrder && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
              {!selectedAddress ? 'Choose a delivery address to continue.' : step !== 'review' ? 'Choose a payment method to continue.' : ''}
            </p>
          )}

          <h3 style={{ fontSize: '1.05rem', color: 'var(--secondary)', margin: '1.25rem 0 0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>Order Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Items ({itemCount})</span><span>{API.formatCurrency(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery</span><span>{shipping === 0 ? <strong style={{ color: 'var(--success)' }}>FREE</strong> : API.formatCurrency(shipping)}</span></div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}><span>Coupon ({coupon.code})</span><span>- {API.formatCurrency(discount)}</span></div>
            )}
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.4rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, color: 'var(--secondary)' }}><span>Order Total</span><span>{API.formatCurrency(finalTotal)}</span></div>
          </div>
          {step === 'review' && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Paying by <strong>{PAYMENT_OPTIONS[paymentMethod].title}</strong>
            </p>
          )}
        </div>
      </div>
    </main>
  );
};
