import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

const getStepIndex = (status) => {
  switch (status) {
    case 'PENDING':
    case 'PAYMENT_VERIFICATION_PENDING': return 1;
    case 'PROCESSING': return 2;
    case 'SHIPPED': return 3;
    case 'DELIVERED': return 4;
    default: return 0;
  }
};

const inputStyle = { border: '1px solid var(--border-color)', padding: '0.6rem', width: '100%' };

export const OrdersPage = () => {
  const { isLoggedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Order whose cancellation form is open
  const [cancelOrder, setCancelOrder] = useState(null);
  const [refundNumber, setRefundNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    API.request('/orders/my-orders')
      .then((data) => {
        setOrders(data);
        setLoading(false);
      })
      .catch(() => {
        setOrders([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isLoggedIn) fetchOrders();
  }, [isLoggedIn]);

  const openCancel = (order) => {
    setRefundNumber('');
    setCancelReason('');
    setCancelOrder(order);
  };

  const handleCancelRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.request(`/orders/${cancelOrder.id}/cancel-request`, {
        method: 'POST',
        body: JSON.stringify({ refund_gpay_number: refundNumber.trim(), reason: cancelReason.trim() })
      });
      API.showToast('Cancellation request submitted. We will review it shortly.', 'info');
      setCancelOrder(null);
      fetchOrders();
    } catch (err) {
      API.showToast(err.message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <h2 style={{ fontSize: '1.6rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>My Orders & Live Tracking</h2>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '4rem' }}><i className="fas fa-spinner fa-spin fa-2x"></i><br /><br />Fetching orders...</p>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <i className="fas fa-box-open" style={{ fontSize: '3rem', color: 'var(--text-light)', marginBottom: '1rem' }}></i>
          <h3>No Orders Placed Yet</h3>
          <Link to="/products" className="btn btn-primary" style={{ marginTop: '1rem' }}>Start Shopping</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {orders.map((ord) => {
            const stepIdx = getStepIndex(ord.status);
            const isCancelled = ord.status === 'CANCELLED';
            const addr = ord.address_snapshot || {};
            const canRequestCancel = !['DELIVERED', 'CANCELLED'].includes(ord.status) && !ord.cancel_request_status;
            const needsPayment = ord.payment_method === 'UPI' && ['UNPAID', 'FAILED'].includes(ord.payment_status) && !isCancelled;

            return (
              <div key={ord.id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                {/* Header info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong>Order #{ord.order_number || ord.id}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                      Placed on {new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className={`badge badge-${isCancelled ? 'danger' : stepIdx === 4 ? 'success' : 'warning'}`}>
                      {(STATUS_LABELS[ord.status] || ord.status || '').toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 800, color: 'var(--secondary)', marginLeft: '1rem', fontSize: '1.1rem' }}>
                      {API.formatCurrency(ord.total)}
                    </span>
                  </div>
                </div>

                {needsPayment && (
                  <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', padding: '0.7rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>
                      <i className="fas fa-clock" style={{ color: '#f59e0b' }}></i>{' '}
                      {ord.payment_status === 'FAILED'
                        ? `Payment could not be verified${ord.payment_notes ? ` (${ord.payment_notes})` : ''}. Please pay again.`
                        : 'Payment pending. Complete your UPI payment to confirm this order.'}
                    </span>
                    <Link to={`/order/${ord.id}/payment`} className="btn btn-primary btn-sm">Complete Payment</Link>
                  </div>
                )}

                {/* Progress Stepper Line */}
                {!isCancelled && (
                  <div className="tracking-stepper">
                    <div className={`step-item ${stepIdx >= 1 ? 'completed' : ''}`}>
                      <div className="step-icon"><i className="fas fa-check"></i></div>
                      <span>Placed</span>
                    </div>
                    <div className={`step-item ${stepIdx >= 2 ? 'completed' : ''}`}>
                      <div className="step-icon"><i className="fas fa-cog"></i></div>
                      <span>Processing</span>
                    </div>
                    <div className={`step-item ${stepIdx >= 3 ? 'completed' : ''}`}>
                      <div className="step-icon"><i className="fas fa-truck"></i></div>
                      <span>Shipped</span>
                    </div>
                    <div className={`step-item ${stepIdx >= 4 ? 'completed' : ''}`}>
                      <div className="step-icon"><i className="fas fa-home"></i></div>
                      <span>Delivered</span>
                    </div>
                  </div>
                )}

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '6px' }}>
                  {(ord.items || []).map((i) => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span>{i.product_name} ({i.variant_details}) x{i.quantity}</span>
                      <strong>{API.formatCurrency(API.toNumber(i.price) * i.quantity)}</strong>
                    </div>
                  ))}
                  {API.toNumber(ord.discount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success)' }}>
                      <span>Coupon discount</span><span>- {API.formatCurrency(ord.discount)}</span>
                    </div>
                  )}
                </div>

                {/* Payment & delivery */}
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>
                    Payment: <strong>{ord.payment_method}</strong> · {PAYMENT_LABELS[ord.payment_status] || ord.payment_status}
                  </span>
                  {addr.full_name && (
                    <span>Deliver to: {addr.full_name}, {addr.city}, {addr.state} - {addr.postal_code}</span>
                  )}
                </div>

                {ord.cancel_request_status && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                    Cancellation request:{' '}
                    <span className={`badge badge-${ord.cancel_request_status === 'APPROVED' ? 'success' : ord.cancel_request_status === 'REJECTED' ? 'danger' : 'warning'}`}>
                      {ord.cancel_request_status}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link to={`/order/${ord.id}`} className="btn btn-outline btn-sm">View Order Details</Link>
                  {canRequestCancel && (
                    <button onClick={() => openCancel(ord)} className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '440px' }}>
            <form onSubmit={handleCancelRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3>Cancel Order #{cancelOrder.order_number}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Your request will be reviewed by our team. Any amount paid is refunded to the GPay/UPI number below.
              </p>
              <input type="text" placeholder="GPay / UPI number for refund *" required value={refundNumber} onChange={(e) => setRefundNumber(e.target.value)} className="search-input" style={inputStyle} />
              <textarea placeholder="Reason (optional)" rows="3" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="search-input" style={inputStyle}></textarea>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  {submitting ? 'Submitting...' : 'Request Cancellation'}
                </button>
                <button type="button" onClick={() => setCancelOrder(null)} className="btn btn-outline">Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
