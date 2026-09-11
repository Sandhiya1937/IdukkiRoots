import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { API } from '../api';

// Values of orders.status / orders.payment_status in database/schema_pg.sql
const STATUS_LABELS = {
  PENDING: 'Pending',
  PAYMENT_VERIFICATION_PENDING: 'Verifying Payment',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled'
};

const PAYMENT_LABELS = {
  UNPAID: 'Unpaid',
  PENDING_VERIFICATION: 'Verification Pending',
  PAID: 'Paid',
  FAILED: 'Payment Rejected',
  REFUNDED: 'Refunded'
};

const cardStyle = { background: 'var(--bg-surface)', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' };
const headingStyle = { fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' };
const row = { display: 'flex', justifyContent: 'space-between', gap: '1rem' };

// Order confirmation (right after checkout / payment) and order details page
export const OrderDetailsPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const justPlaced = !!location.state?.justPlaced;
  const paymentSubmitted = !!location.state?.paymentSubmitted;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    API.request(`/orders/${id}`)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
        <i className="fas fa-spinner fa-spin fa-2x"></i><br /><br />Loading your order...
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

  const addr = order.address_snapshot || {};
  const items = order.items || [];
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const isCancelled = order.status === 'CANCELLED';
  const awaitingPayment = order.payment_method === 'UPI' && ['UNPAID', 'FAILED'].includes(order.payment_status) && !isCancelled;
  const verifying = order.payment_status === 'PENDING_VERIFICATION';

  let banner = null;
  if (awaitingPayment) {
    banner = {
      tone: 'warning',
      title: 'Complete your payment to confirm this order',
      text: `Pay ${API.formatCurrency(order.total)} via UPI and submit the transaction reference.`
    };
  } else if (justPlaced || paymentSubmitted) {
    banner = verifying
      ? { tone: 'success', title: 'Thank you! Your order is placed and your payment is being verified.', text: 'We will confirm your payment shortly and then start packing your order.' }
      : {
          tone: 'success',
          title: 'Order placed, thank you!',
          text: order.payment_method === 'COD'
            ? `Please keep ${API.formatCurrency(order.total)} ready to pay in cash when your order is delivered.`
            : 'We will start packing your order right away.'
        };
  }
  const bannerColor = banner?.tone === 'warning' ? '#f59e0b' : '#10b981';

  return (
    <main style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem' }}>
      {banner && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-md)', border: `1px solid ${bannerColor}`, background: banner.tone === 'warning' ? '#fffbeb' : '#ecfdf5', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <i className={`fas ${banner.tone === 'warning' ? 'fa-clock' : 'fa-check-circle'}`} style={{ fontSize: '1.8rem', color: bannerColor }}></i>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--secondary)' }}>{banner.title}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.9rem' }}>{banner.text}</p>
          </div>
          {awaitingPayment && <Link to={`/order/${order.id}/payment`} className="btn btn-primary">Pay Now</Link>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--secondary)' }}>Order #{order.order_number}</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Placed on {new Date(order.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <span className={`badge badge-${isCancelled ? 'danger' : order.status === 'DELIVERED' ? 'success' : 'warning'}`}>
          {(STATUS_LABELS[order.status] || order.status || '').toUpperCase()}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div style={cardStyle}>
          <div style={headingStyle}>Delivery address</div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
            <strong>{addr.full_name}</strong><br />
            {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}<br />
            {addr.city}, {addr.state} - {addr.postal_code}<br />
            Phone: {addr.phone}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={headingStyle}>Payment</div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
            {order.payment_method === 'COD' ? 'Cash on Delivery' : order.payment_method === 'UPI' ? 'UPI' : order.payment_method}<br />
            Status: <strong>{PAYMENT_LABELS[order.payment_status] || order.payment_status}</strong><br />
            {order.payment?.utr_number && <>UTR: <code>{order.payment.utr_number}</code><br /></>}
            {order.payment_status === 'FAILED' && order.payment?.notes && <span style={{ color: 'var(--danger)' }}>{order.payment.notes}</span>}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={headingStyle}>Order summary</div>
          <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={row}><span>Items ({itemCount})</span><span>{API.formatCurrency(order.subtotal)}</span></div>
            <div style={row}><span>Delivery</span><span>{API.toNumber(order.shipping_charge) === 0 ? 'FREE' : API.formatCurrency(order.shipping_charge)}</span></div>
            {API.toNumber(order.discount) > 0 && (
              <div style={{ ...row, color: 'var(--success)' }}><span>Coupon discount</span><span>- {API.formatCurrency(order.discount)}</span></div>
            )}
            <div style={{ ...row, fontWeight: 800, fontSize: '1.05rem', color: 'var(--secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
              <span>Order Total</span><span>{API.formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={headingStyle}>Items in this order</div>
        {items.map((i) => (
          <div key={i.id} style={{ ...row, alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
            <span><strong>{i.product_name}</strong> <span style={{ color: 'var(--text-muted)' }}>({i.variant_details}) × {i.quantity}</span></span>
            <strong>{API.formatCurrency(API.toNumber(i.price) * i.quantity)}</strong>
          </div>
        ))}
        {order.cancellation && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
            Cancellation request: <span className={`badge badge-${order.cancellation.status === 'APPROVED' ? 'success' : order.cancellation.status === 'REJECTED' ? 'danger' : 'warning'}`}>{order.cancellation.status}</span>
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/orders" className="btn btn-primary">Track all orders</Link>
        <Link to="/products" className="btn btn-outline">Continue shopping</Link>
      </div>
    </main>
  );
};
