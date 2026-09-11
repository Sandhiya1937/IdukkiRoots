import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { API } from '../api';

const inputStyle = { border: '1px solid var(--border-color)', padding: '0.7rem', width: '100%' };
const cardStyle = { background: 'var(--bg-surface)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' };

// Shown right after a UPI order is placed (and from My Orders) until the customer submits payment details
export const OrderPaymentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useCart();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    API.request(`/orders/${id}`)
      .then((data) => {
        // Only unpaid UPI orders need this page; everything else goes to the order details
        if (data.payment_method !== 'UPI' || !['UNPAID', 'FAILED'].includes(data.payment_status) || data.status === 'CANCELLED') {
          navigate(`/order/${id}`, { replace: true });
          return;
        }
        setOrder(data);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const reference = utr.trim();
    if (!/^[A-Za-z0-9]{6,35}$/.test(reference)) {
      API.showToast('Enter the UTR / transaction ID exactly as shown in your UPI app', 'danger');
      return;
    }
    setSubmitting(true);
    try {
      const proof = new FormData();
      proof.append('utr_number', reference);
      if (screenshot) proof.append('screenshot', screenshot);
      await API.request(`/orders/${id}/payment-proof`, { method: 'POST', body: proof });
      navigate(`/order/${id}`, { replace: true, state: { paymentSubmitted: true } });
    } catch (err) {
      API.showToast(err.message || 'Could not submit payment details', 'danger');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
        <i className="fas fa-spinner fa-spin fa-2x"></i><br /><br />Loading payment details...
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem' }}>
        <h2>Order not found</h2>
        <Link to="/orders" className="btn btn-primary" style={{ marginTop: '1rem' }}>Go to My Orders</Link>
      </div>
    );
  }

  const amount = API.toNumber(order.total);
  const upiId = settings.upi_id;
  // Prefer the QR uploaded by the admin; otherwise build one from the configured UPI ID (with the amount filled in)
  const uploadedQr = settings.payment_qr_url && !qrFailed ? settings.payment_qr_url : null;
  const generatedQr = upiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=IdukkiRoots&am=${amount.toFixed(2)}&cu=INR&tn=${order.order_number}`)}`
    : null;
  const qrSrc = uploadedQr || generatedQr;
  const addr = order.address_snapshot || {};

  return (
    <main style={{ maxWidth: '980px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <h2 style={{ fontSize: '1.6rem', color: 'var(--secondary)' }}>Complete your payment</h2>
      <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0 1.5rem' }}>
        Order <strong>#{order.order_number}</strong> has been placed. Pay now so we can confirm and ship it.
      </p>

      {order.payment_status === 'FAILED' && (
        <div style={{ background: '#fef2f2', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.9rem 1.1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <i className="fas fa-exclamation-circle"></i> We couldn't verify your previous payment
          {order.payment?.notes ? `: ${order.payment.notes}` : ''}. Please check the reference number or pay again.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* QR */}
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Amount to pay</span>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--secondary)', margin: '0.2rem 0 1rem' }}>{API.formatCurrency(amount)}</div>
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="UPI QR code"
              onError={() => setQrFailed(true)}
              style={{ width: '240px', maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', margin: '0 auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}
            />
          ) : (
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>
              UPI payment details are not configured yet. Please contact us at {settings.support_phone || settings.support_email || 'our support desk'}.
            </p>
          )}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            Scan with PhonePe, Google Pay, Paytm or any UPI app
          </p>
          {upiId && <p style={{ fontSize: '0.9rem', marginTop: '0.3rem' }}>UPI ID: <strong>{upiId}</strong></p>}
        </div>

        {/* Payment confirmation */}
        <form onSubmit={handleSubmit} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--secondary)' }}>After paying</h3>
          <ol style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>Pay exactly <strong>{API.formatCurrency(amount)}</strong> using the QR code.</li>
            <li>Copy the 12-digit UTR / transaction ID shown in your UPI app.</li>
            <li>Enter it below. A screenshot helps us verify faster.</li>
          </ol>
          <input
            type="text"
            placeholder="12-digit UTR / reference number"
            required
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            className="search-input"
            style={inputStyle}
          />
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Payment screenshot (optional, JPG/PNG/WEBP up to 5MB)
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setScreenshot(e.target.files[0] || null)} style={{ display: 'block', marginTop: '0.3rem' }} />
          </label>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ height: '46px' }}>
            {submitting ? 'Submitting...' : 'Submit payment details'}
          </button>
          <Link to={`/order/${order.id}`} style={{ fontSize: '0.85rem', color: 'var(--primary)', textAlign: 'center' }}>
            I'll pay later - you can complete payment from My Orders
          </Link>
          {addr.full_name && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              Delivering to {addr.full_name}, {addr.city} - {addr.postal_code}
            </p>
          )}
        </form>
      </div>
    </main>
  );
};
