import React, { useState, useEffect } from 'react';
import { API } from '../../api';

// Values allowed by the orders.status CHECK constraint
const ORDER_STATUSES = ['PENDING', 'PAYMENT_VERIFICATION_PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const WEIGHT_UNITS = ['g', 'kg', 'ml', 'l', 'pcs'];

const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const fullName = (row) => [row.first_name, row.last_name].filter(Boolean).join(' ');
const formatDate = (value) => (value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const humanize = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const emptyVariant = () => ({ weight_value: '250', weight_unit: 'g', mrp: '', price: '', stock: '100' });
const emptyProduct = () => ({ id: null, name: '', slug: '', category_id: '', subcategory_id: '', description: '', image_url: '', custom_tag: '', custom_discount_text: '', is_active: true, variants: [emptyVariant()], images: [] });
const emptyCoupon = () => ({ code: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 499, max_discount_amount: '' });
const emptyCategory = () => ({ id: null, name: '', slug: '', description: '' });

const inputStyle = { border: '1px solid var(--border-color)', padding: '0.6rem', borderRadius: '6px', width: '100%' };
const cardStyle = { background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' };
const smallBtn = { padding: '0.2rem 0.5rem', fontSize: '0.75rem' };
const iconBtn = (color) => ({ border: 'none', background: 'none', color, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: '0.2rem 0.4rem' });

const Modal = ({ title, onClose, children, maxWidth = '500px' }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
    <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>{title}</h3>
        <button type="button" onClick={onClose} style={iconBtn('var(--text-muted)')}><i className="fas fa-times"></i></button>
      </div>
      {children}
    </div>
  </div>
);

const StatCard = ({ label, value, color }) => (
  <div style={cardStyle}>
    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
    <h3 style={{ fontSize: '1.8rem', color, marginTop: '0.4rem' }}>{value}</h3>
  </div>
);

const SectionHeader = ({ title, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
    <h2 style={{ fontSize: '1.4rem', color: 'var(--secondary)' }}>{title}</h2>
    {children}
  </div>
);

const OrderDetails = ({ order }) => {
  const addr = order.address_snapshot || {};
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', fontSize: '0.85rem', padding: '0.5rem' }}>
      <div>
        <strong>Items</strong>
        {(order.items || []).map((i) => (
          <div key={i.id}>{i.product_name} ({i.variant_details}) x{i.quantity} - {API.formatCurrency(API.toNumber(i.price) * i.quantity)}</div>
        ))}
        <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
          Subtotal {API.formatCurrency(order.subtotal)} · Discount {API.formatCurrency(order.discount)} · Shipping {API.formatCurrency(order.shipping_charge)}
        </div>
      </div>
      <div>
        <strong>Delivery Address</strong>
        <div>{addr.full_name} ({addr.phone})</div>
        <div>{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}, {addr.city}, {addr.state} - {addr.postal_code}</div>
        {order.email && <div style={{ color: 'var(--text-muted)' }}>Account: {order.email}</div>}
      </div>
    </div>
  );
};

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ total_sales: 0, total_orders: 0, pending_payments: 0, total_customers: 0, low_stock_items: 0 });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [banners, setBanners] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settingsForm, setSettingsForm] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Modal / form state (a null form means the modal is closed)
  const [productForm, setProductForm] = useState(null);
  const [productFiles, setProductFiles] = useState([]);
  const [couponForm, setCouponForm] = useState(null);
  const [customerForm, setCustomerForm] = useState(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategory());
  const [subcategoryForm, setSubcategoryForm] = useState({ category_id: '', name: '' });
  const [bannerForm, setBannerForm] = useState({ title: '', subtitle: '', link_url: '/products' });
  const [bannerFiles, setBannerFiles] = useState([]);
  const [qrFile, setQrFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const loadData = () => {
    API.request('/admin/dashboard').then(setStats).catch(() => {});
    API.request('/admin/products/list').then(setProducts).catch(() => {});
    API.request('/admin/categories').then(setCategories).catch(() => {});
    API.request('/admin/orders').then(setOrders).catch(() => {});
    API.request('/admin/payments/pending').then(setPayments).catch(() => {});
    API.request('/admin/orders/cancellations').then(setCancellations).catch(() => {});
    API.request('/admin/coupons').then(setCoupons).catch(() => {});
    API.request('/admin/reviews').then(setReviews).catch(() => {});
    API.request('/admin/banners').then(setBanners).catch(() => {});
    API.request('/admin/users').then(setCustomers).catch(() => {});
    API.request('/admin/settings').then((data) => setSettingsForm({ upi_id: '', ...data })).catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  // Runs an admin API call, reports the outcome and refreshes the dashboard. Returns null on failure.
  const run = async (action, successMessage) => {
    try {
      const res = await action();
      API.showToast(successMessage || res?.message || 'Saved', 'success');
      loadData();
      return res || {};
    } catch (err) {
      API.showToast(err.message || 'Request failed', 'danger');
      return null;
    }
  };
  const post = (url, body) => API.request(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body || {}) });
  const put = (url, body) => API.request(url, { method: 'PUT', body: JSON.stringify(body) });
  const del = (url) => API.request(url, { method: 'DELETE' });

  // ---------- Products ----------
  const openProductEditor = async (productId) => {
    setProductFiles([]);
    if (!productId) {
      setProductForm(emptyProduct());
      return;
    }
    try {
      const p = await API.request(`/admin/products/${productId}`);
      setProductForm({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category_id: p.category_id || '',
        subcategory_id: p.subcategory_id || '',
        description: p.description || '',
        image_url: '',
        custom_tag: p.custom_tag || '',
        custom_discount_text: p.custom_discount_text || '',
        is_active: p.is_active,
        variants: (p.variants || []).length > 0
          ? p.variants.map((v) => ({ id: v.id, sku: v.sku, weight_value: API.toNumber(v.weight_value), weight_unit: v.weight_unit || 'g', mrp: API.toNumber(v.mrp), price: API.toNumber(v.price), stock: v.stock }))
          : [emptyVariant()],
        images: p.images || []
      });
    } catch (err) {
      API.showToast(err.message, 'danger');
    }
  };

  const updateVariant = (idx, field, value) =>
    setProductForm((f) => ({ ...f, variants: f.variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)) }));

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const { images, ...form } = productForm;
    const payload = { ...form, slug: form.slug.trim() || slugify(form.name) };
    const saved = await run(
      () => (form.id ? put(`/admin/products/${form.id}`, payload) : post('/admin/products', payload)),
      form.id ? 'Product updated' : 'Product created'
    );
    if (!saved) return;

    const productId = form.id || saved.product_id;
    if (productFiles.length > 0 && productId) {
      const fd = new FormData();
      productFiles.forEach((file) => fd.append('images', file));
      await run(() => post(`/admin/products/${productId}/images`, fd), 'Images uploaded');
    }
    setProductForm(null);
  };

  const setProductActive = async (product, active) => {
    if (!active) {
      if (!window.confirm(`Deactivate "${product.name}"? It will be hidden from the store.`)) return;
      await run(() => del(`/admin/products/${product.id}`), 'Product deactivated');
      return;
    }
    // Re-activation goes through the full update endpoint
    try {
      const p = await API.request(`/admin/products/${product.id}`);
      await run(() => put(`/admin/products/${product.id}`, { ...p, is_active: true }), 'Product activated');
    } catch (err) {
      API.showToast(err.message, 'danger');
    }
  };

  // ---------- Categories ----------
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const payload = { ...categoryForm, slug: categoryForm.slug.trim() || slugify(categoryForm.name) };
    const ok = await run(
      () => (categoryForm.id ? put(`/admin/categories/${categoryForm.id}`, payload) : post('/admin/categories', payload)),
      categoryForm.id ? 'Category updated' : 'Category created'
    );
    if (ok) setCategoryForm(emptyCategory());
  };

  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => post('/admin/subcategories', { category_id: subcategoryForm.category_id, name: subcategoryForm.name, slug: slugify(subcategoryForm.name) }),
      'Subcategory added'
    );
    if (ok) setSubcategoryForm({ category_id: subcategoryForm.category_id, name: '' });
  };

  // ---------- Orders / payments / cancellations ----------
  const handleUpdateOrderStatus = (order, status) =>
    run(() => put(`/admin/orders/${order.id}/status`, { status }), `Order ${order.order_number} marked ${status.replace(/_/g, ' ')}`);

  const handleVerifyPayment = (payment, action) => {
    let notes;
    if (action === 'REJECT') {
      notes = window.prompt('Reason for rejecting this payment (shown to the customer):', 'UTR could not be verified');
      if (notes === null) return;
    }
    run(() => post('/admin/payments/verify', { payment_id: payment.id, action, notes }), action === 'APPROVE' ? 'Payment approved' : 'Payment rejected');
  };

  const handleCancellation = (request, action) => {
    if (action === 'approve' && !window.confirm(`Approve cancellation of ${request.order_number}? Stock will be restored and the order marked refunded (refund to ${request.refund_gpay_number}).`)) return;
    run(() => post(`/admin/orders/cancellations/${request.id}/${action}`), action === 'approve' ? 'Cancellation approved' : 'Cancellation rejected');
  };

  // ---------- Coupons ----------
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    const ok = await run(() => post('/admin/coupons', couponForm), 'Coupon created');
    if (ok) setCouponForm(null);
  };

  // ---------- Reviews ----------
  const toggleReviewVisibility = (r) =>
    run(
      () => put(`/admin/reviews/${r.id}`, { user_name: r.user_name, rating: r.rating, comment: r.comment, status: r.status === 'HIDDEN' ? 'APPROVED' : 'HIDDEN' }),
      r.status === 'HIDDEN' ? 'Review is visible again' : 'Review hidden'
    );

  // ---------- Banners ----------
  const handleUploadBanner = async (e) => {
    e.preventDefault();
    if (bannerFiles.length === 0) {
      API.showToast('Choose at least one banner image', 'danger');
      return;
    }
    const fd = new FormData();
    fd.append('title', bannerForm.title);
    fd.append('subtitle', bannerForm.subtitle);
    fd.append('link_url', bannerForm.link_url);
    bannerFiles.forEach((file) => fd.append('images', file));
    const ok = await run(() => post('/admin/banners', fd));
    if (ok) {
      setBannerForm({ title: '', subtitle: '', link_url: '/products' });
      setBannerFiles([]);
      setFileInputKey((k) => k + 1);
    }
  };

  // ---------- Customers ----------
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const { id, ...payload } = customerForm;
    const ok = await run(() => put(`/admin/users/${id}`, payload), 'Customer updated');
    if (ok) setCustomerForm(null);
  };

  // ---------- Settings ----------
  const handleSaveSettings = (e) => {
    e.preventDefault();
    run(() => post('/admin/settings', { settings: settingsForm }), 'Settings saved');
  };

  const handleUploadQr = async () => {
    if (!qrFile) {
      API.showToast('Choose a QR code image first', 'danger');
      return;
    }
    const fd = new FormData();
    fd.append('image', qrFile);
    const ok = await run(() => post('/admin/settings/upload-qr', fd));
    if (ok) {
      setQrFile(null);
      setFileInputKey((k) => k + 1);
    }
  };

  const tabs = [
    { key: 'overview', icon: 'fa-chart-line', label: 'Dashboard Overview' },
    { key: 'products', icon: 'fa-boxes', label: 'Inventory Products' },
    { key: 'categories', icon: 'fa-tags', label: 'Categories' },
    { key: 'orders', icon: 'fa-shopping-cart', label: 'Orders Management' },
    { key: 'payments', icon: 'fa-money-check-alt', label: `Payment Verification (${payments.length})` },
    { key: 'cancellations', icon: 'fa-undo', label: `Cancellations (${cancellations.length})` },
    { key: 'coupons', icon: 'fa-ticket-alt', label: 'Promo Coupons' },
    { key: 'reviews', icon: 'fa-comments', label: `Review Moderation (${reviews.length})` },
    { key: 'banners', icon: 'fa-images', label: 'Homepage Banners' },
    { key: 'customers', icon: 'fa-users', label: 'Customers' },
    { key: 'settings', icon: 'fa-cog', label: 'Store Settings' }
  ];

  const formSubcategories = categories.find((c) => String(c.id) === String(productForm?.category_id))?.subcategories || [];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <h3 style={{ color: '#ffffff', fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-user-shield"></i> Admin Portal
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`nav-link ${activeTab === t.key ? 'active' : ''}`}>
              <i className={`fas ${t.icon}`}></i> {t.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content View */}
      <main className="admin-content">
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>Store Analytics Dashboard</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <StatCard label="TOTAL REVENUE (PAID)" value={API.formatCurrency(stats.total_sales)} color="var(--primary-dark)" />
              <StatCard label="TOTAL ORDERS" value={stats.total_orders} color="var(--secondary)" />
              <StatCard label="TOTAL PRODUCTS" value={products.length} color="var(--accent-gold)" />
              <StatCard label="PENDING PAYMENTS" value={stats.pending_payments} color="var(--danger)" />
              <StatCard label="CUSTOMERS" value={stats.total_customers} color="var(--secondary)" />
              <StatCard label="LOW STOCK VARIANTS (<10)" value={stats.low_stock_items} color="var(--danger)" />
            </div>
            {(payments.length > 0 || cancellations.length > 0) && (
              <div style={{ ...cardStyle, display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>Needs attention:</strong>
                {payments.length > 0 && <button onClick={() => setActiveTab('payments')} className="btn btn-outline btn-sm">{payments.length} payment(s) to verify</button>}
                {cancellations.length > 0 && <button onClick={() => setActiveTab('cancellations')} className="btn btn-outline btn-sm">{cancellations.length} cancellation request(s)</button>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <SectionHeader title={`Products Inventory (${products.length})`}>
              <button onClick={() => openProductEditor(null)} className="btn btn-primary btn-sm">
                <i className="fas fa-plus"></i> Add New Product
              </button>
            </SectionHeader>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Product Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.6 }}>
                      <td>#{p.id}</td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.category_name || '-'}</td>
                      <td>{API.formatCurrency(p.price)}</td>
                      <td><span className={`badge badge-${p.stock >= 10 ? 'success' : 'danger'}`}>{p.stock ?? 0}</span></td>
                      <td><span className={`badge badge-${p.is_active ? 'success' : 'danger'}`}>{p.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => openProductEditor(p.id)} style={iconBtn('var(--primary)')} title="Edit product"><i className="fas fa-pen"></i></button>
                        {p.is_active ? (
                          <button onClick={() => setProductActive(p, false)} style={iconBtn('var(--danger)')} title="Deactivate product"><i className="far fa-trash-alt"></i></button>
                        ) : (
                          <button onClick={() => setProductActive(p, true)} style={iconBtn('var(--success)')} title="Activate product">Activate</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            <SectionHeader title={`Categories (${categories.length})`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <form onSubmit={handleSaveCategory} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <strong>{categoryForm.id ? 'Edit Category' : 'Add Category'}</strong>
                <input type="text" placeholder="Category Name *" required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="search-input" style={inputStyle} />
                <input type="text" placeholder="Slug (auto from name)" value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} className="search-input" style={inputStyle} />
                <textarea placeholder="Description" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} className="search-input" style={inputStyle}></textarea>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary btn-sm">{categoryForm.id ? 'Save Changes' : 'Add Category'}</button>
                  {categoryForm.id && <button type="button" onClick={() => setCategoryForm(emptyCategory())} className="btn btn-outline btn-sm">Cancel</button>}
                </div>
              </form>

              <form onSubmit={handleAddSubcategory} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <strong>Add Subcategory</strong>
                <select required value={subcategoryForm.category_id} onChange={(e) => setSubcategoryForm({ ...subcategoryForm, category_id: e.target.value })} style={inputStyle}>
                  <option value="">Select parent category *</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Subcategory Name *" required value={subcategoryForm.name} onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })} className="search-input" style={inputStyle} />
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: 'fit-content' }}>Add Subcategory</button>
              </form>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Slug</th><th>Subcategories</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{c.description}</small></td>
                      <td>{c.slug}</td>
                      <td>
                        {(c.subcategories || []).map((s) => (
                          <span key={s.id} className="badge badge-info" style={{ marginRight: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            {s.name}
                            <button
                              onClick={() => window.confirm(`Delete subcategory "${s.name}"?`) && run(() => del(`/admin/subcategories/${s.id}`), 'Subcategory deleted')}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                              title="Delete subcategory"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </span>
                        ))}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button onClick={() => setCategoryForm({ id: c.id, name: c.name, slug: c.slug, description: c.description || '', image_url: c.image_url, service_charge: c.service_charge })} style={iconBtn('var(--primary)')} title="Edit category"><i className="fas fa-pen"></i></button>
                        <button
                          onClick={() => window.confirm(`Delete category "${c.name}"? Its subcategories are removed and its products become uncategorised.`) && run(() => del(`/admin/categories/${c.id}`), 'Category deleted')}
                          style={iconBtn('var(--danger)')}
                          title="Delete category"
                        >
                          <i className="far fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <SectionHeader title={`Orders Fulfillment (${orders.length})`} />
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Total Amount</th><th>Payment</th><th>Order Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <React.Fragment key={o.id}>
                      <tr>
                        <td><strong>{o.order_number}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{formatDate(o.created_at)}</small></td>
                        <td>
                          {fullName(o) || o.address_snapshot?.full_name || 'Guest'}
                          <br /><small style={{ color: 'var(--text-muted)' }}>{o.address_snapshot?.phone || o.customer_phone || ''}</small>
                        </td>
                        <td><strong>{API.formatCurrency(o.total)}</strong></td>
                        <td>
                          <span className="badge badge-info">{o.payment_method}</span>{' '}
                          <span className={`badge badge-${o.payment_status === 'PAID' ? 'success' : ['FAILED', 'REFUNDED'].includes(o.payment_status) ? 'danger' : 'warning'}`}>{o.payment_status}</span>
                        </td>
                        <td>
                          <select
                            value={o.status}
                            onChange={(e) => handleUpdateOrderStatus(o, e.target.value)}
                            style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          >
                            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                        </td>
                        <td>
                          <button onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)} className="btn btn-outline btn-sm" style={smallBtn}>
                            {expandedOrderId === o.id ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {expandedOrderId === o.id && (
                        <tr>
                          <td colSpan={6} style={{ background: '#f8fafc' }}><OrderDetails order={o} /></td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <SectionHeader title={`UPI Payment Verification (${payments.length})`} />
            {payments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No payments waiting for verification.</p>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr><th>Order</th><th>Customer</th><th>Amount</th><th>UTR / Ref</th><th>Screenshot</th><th>Submitted</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.order_number}</strong></td>
                        <td>{fullName(p) || 'Guest'}<br /><small style={{ color: 'var(--text-muted)' }}>{p.email}</small></td>
                        <td><strong>{API.formatCurrency(p.total)}</strong></td>
                        <td><code>{p.utr_number}</code></td>
                        <td>{p.proof_image_url ? <a href={p.proof_image_url} target="_blank" rel="noreferrer">View</a> : '-'}</td>
                        <td>{formatDate(p.created_at)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleVerifyPayment(p, 'APPROVE')} className="btn btn-primary btn-sm" style={smallBtn}>Approve</button>{' '}
                          <button onClick={() => handleVerifyPayment(p, 'REJECT')} className="btn btn-outline btn-sm" style={{ ...smallBtn, color: 'var(--danger)', borderColor: 'var(--danger)' }}>Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cancellations' && (
          <div>
            <SectionHeader title={`Cancellation & Refund Requests (${cancellations.length})`} />
            {cancellations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No pending cancellation requests.</p>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr><th>Order</th><th>Customer</th><th>Amount</th><th>Refund To</th><th>Reason</th><th>Requested</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {cancellations.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.order_number}</strong><br /><small className="badge badge-info">{c.payment_method}</small></td>
                        <td>{fullName(c) || 'Guest'}<br /><small style={{ color: 'var(--text-muted)' }}>{c.email}</small></td>
                        <td><strong>{API.formatCurrency(c.total)}</strong></td>
                        <td><code>{c.refund_gpay_number}</code></td>
                        <td>{c.reason}</td>
                        <td>{formatDate(c.requested_at)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleCancellation(c, 'approve')} className="btn btn-primary btn-sm" style={smallBtn}>Approve</button>{' '}
                          <button onClick={() => handleCancellation(c, 'reject')} className="btn btn-outline btn-sm" style={{ ...smallBtn, color: 'var(--danger)', borderColor: 'var(--danger)' }}>Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'coupons' && (
          <div>
            <SectionHeader title="Promotional Coupons">
              <button onClick={() => setCouponForm(emptyCoupon())} className="btn btn-primary btn-sm">
                <i className="fas fa-plus"></i> Create Coupon
              </button>
            </SectionHeader>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr><th>Code</th><th>Discount</th><th>Min Order Value</th><th>Max Discount</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong></td>
                      <td>{c.discount_type === 'percentage' ? `${API.toNumber(c.discount_value)}% OFF` : `${API.formatCurrency(c.discount_value)} OFF`}</td>
                      <td>{API.formatCurrency(c.min_order_amount)}</td>
                      <td>{c.max_discount_amount ? API.formatCurrency(c.max_discount_amount) : '-'}</td>
                      <td><span className={`badge badge-${c.is_active ? 'success' : 'danger'}`}>{c.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                      <td>
                        <button
                          onClick={() => window.confirm(`Delete coupon ${c.code}?`) && run(() => del(`/admin/coupons/${c.id}`), 'Coupon deleted')}
                          style={iconBtn('var(--danger)')}
                          title="Delete coupon"
                        >
                          <i className="far fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            <SectionHeader title={`Customer Reviews (${reviews.length})`} />
            {reviews.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No customer reviews yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', opacity: r.status === 'HIDDEN' ? 0.6 : 1 }}>
                    <div>
                      <strong>{r.user_name}</strong> on <em>{r.product_name}</em> ({r.rating}★){' '}
                      <span className={`badge badge-${r.status === 'HIDDEN' ? 'danger' : 'success'}`}>{r.status === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE'}</span>
                      <br />
                      <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>"{r.comment}"</p>
                      <small style={{ color: 'var(--text-light)' }}>{formatDate(r.created_at)}</small>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => toggleReviewVisibility(r)} className="btn btn-outline btn-sm">
                        {r.status === 'HIDDEN' ? 'Approve' : 'Hide'}
                      </button>
                      <button
                        onClick={() => window.confirm('Delete this review permanently?') && run(() => del(`/admin/reviews/${r.id}`), 'Review deleted')}
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'banners' && (
          <div>
            <SectionHeader title={`Homepage Banners (${banners.length})`} />
            <form onSubmit={handleUploadBanner} style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '2rem', alignItems: 'end' }}>
              <input type="text" placeholder="Title" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} className="search-input" style={inputStyle} />
              <input type="text" placeholder="Subtitle" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} className="search-input" style={inputStyle} />
              <input type="text" placeholder="Link (e.g. /products?category=1)" value={bannerForm.link_url} onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })} className="search-input" style={inputStyle} />
              <input key={`banner-${fileInputKey}`} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setBannerFiles(Array.from(e.target.files))} />
              <button type="submit" className="btn btn-primary btn-sm"><i className="fas fa-upload"></i> Upload Banner</button>
            </form>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {banners.map((b) => (
                <div key={b.id} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  <img src={b.image_url} alt={b.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong>{b.title || 'Untitled'}</strong>
                      <div style={{ color: 'var(--text-muted)' }}>{b.subtitle}</div>
                      <small style={{ color: 'var(--text-light)' }}>{b.link_url}</small>
                    </div>
                    <button
                      onClick={() => window.confirm('Delete this banner?') && run(() => del(`/admin/banners/${b.id}`), 'Banner deleted')}
                      style={iconBtn('var(--danger)')}
                      title="Delete banner"
                    >
                      <i className="far fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div>
            <SectionHeader title={`Customers (${customers.length})`} />
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Phone</th><th>Sign-in</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {customers.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{fullName(u) || '-'}</strong></td>
                      <td>{u.email}</td>
                      <td>{u.phone || '-'}</td>
                      <td><span className="badge badge-info">{u.google_id ? 'GOOGLE' : 'EMAIL'}</span></td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>
                        <button
                          onClick={() => setCustomerForm({ id: u.id, first_name: u.first_name || '', last_name: u.last_name || '', email: u.email, phone: u.phone || '', password: '' })}
                          style={iconBtn('var(--primary)')}
                          title="Edit customer"
                        >
                          <i className="fas fa-pen"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <SectionHeader title="Store Settings" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              <form onSubmit={handleSaveSettings} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.keys(settingsForm).filter((key) => key !== 'payment_qr_url').map((key) => (
                  <label key={key} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary)' }}>
                    {key === 'upi_id' ? 'UPI ID (shown at checkout)' : humanize(key)}
                    <input
                      type="text"
                      value={settingsForm[key] ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value })}
                      className="search-input"
                      style={{ ...inputStyle, marginTop: '0.3rem', fontWeight: 400 }}
                    />
                  </label>
                ))}
                <small style={{ color: 'var(--text-muted)' }}>
                  Shipping: orders at or above the free shipping threshold ship free; others pay the shipping charge.
                </small>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: 'fit-content' }}>Save Settings</button>
              </form>

              <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <strong>UPI Payment QR Code</strong>
                {settingsForm.payment_qr_url ? (
                  <img src={settingsForm.payment_qr_url} alt="Current payment QR" style={{ width: '200px', height: '200px', objectFit: 'contain', border: '1px solid var(--border-color)', borderRadius: '8px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No QR uploaded - checkout generates one from the UPI ID.</p>
                )}
                <input key={`qr-${fileInputKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setQrFile(e.target.files[0] || null)} />
                <button type="button" onClick={handleUploadQr} className="btn btn-outline btn-sm" style={{ width: 'fit-content' }}><i className="fas fa-upload"></i> Upload QR</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Product Modal */}
      {productForm && (
        <Modal title={productForm.id ? `Edit Product #${productForm.id}` : 'Add New Product'} onClose={() => setProductForm(null)} maxWidth="720px">
          <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input type="text" placeholder="Product Name *" required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="search-input" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <input type="text" placeholder="Slug (auto from name)" value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} className="search-input" style={inputStyle} />
              <select value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value, subcategory_id: '' })} style={inputStyle}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={productForm.subcategory_id} onChange={(e) => setProductForm({ ...productForm, subcategory_id: e.target.value })} style={inputStyle} disabled={formSubcategories.length === 0}>
                <option value="">No subcategory</option>
                {formSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <textarea placeholder="Description" rows="3" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="search-input" style={inputStyle}></textarea>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input type="text" placeholder="Tag (e.g. Bestseller)" value={productForm.custom_tag} onChange={(e) => setProductForm({ ...productForm, custom_tag: e.target.value })} className="search-input" style={inputStyle} />
              <input type="text" placeholder="Discount text (e.g. 25% OFF)" value={productForm.custom_discount_text} onChange={(e) => setProductForm({ ...productForm, custom_discount_text: e.target.value })} className="search-input" style={inputStyle} />
            </div>

            <div>
              <strong style={{ fontSize: '0.9rem' }}>Variants (weight / price / stock) *</strong>
              {productForm.variants.map((v, idx) => (
                <div key={v.id || `new-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr 1fr 1fr auto', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                  <input type="number" step="any" min="0" placeholder="Weight" required value={v.weight_value} onChange={(e) => updateVariant(idx, 'weight_value', e.target.value)} style={inputStyle} />
                  <select value={v.weight_unit} onChange={(e) => updateVariant(idx, 'weight_unit', e.target.value)} style={inputStyle}>
                    {WEIGHT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" step="0.01" min="0" placeholder="Price ₹ *" required value={v.price} onChange={(e) => updateVariant(idx, 'price', e.target.value)} style={inputStyle} />
                  <input type="number" step="0.01" min="0" placeholder="MRP ₹ *" required value={v.mrp} onChange={(e) => updateVariant(idx, 'mrp', e.target.value)} style={inputStyle} />
                  <input type="number" min="0" placeholder="Stock *" required value={v.stock} onChange={(e) => updateVariant(idx, 'stock', e.target.value)} style={inputStyle} />
                  <button
                    type="button"
                    disabled={productForm.variants.length === 1}
                    onClick={() => setProductForm({ ...productForm, variants: productForm.variants.filter((_, i) => i !== idx) })}
                    style={iconBtn(productForm.variants.length === 1 ? 'var(--text-light)' : 'var(--danger)')}
                    title="Remove variant"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setProductForm({ ...productForm, variants: [...productForm.variants, emptyVariant()] })} className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem' }}>
                <i className="fas fa-plus"></i> Add Variant
              </button>
            </div>

            <div>
              <strong style={{ fontSize: '0.9rem' }}>Images</strong>
              {productForm.images?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.4rem 0' }}>
                  {productForm.images.map((img) => (
                    <img key={img.id} src={img.image_url} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: img.is_primary ? '2px solid var(--primary)' : '1px solid var(--border-color)' }} />
                  ))}
                </div>
              )}
              {!productForm.id && (
                <input type="text" placeholder="Image URL (optional if uploading files)" value={productForm.image_url} onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })} className="search-input" style={{ ...inputStyle, marginTop: '0.4rem' }} />
              )}
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setProductFiles(Array.from(e.target.files))} style={{ marginTop: '0.4rem' }} />
            </div>

            {productForm.id && (
              <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={productForm.is_active} onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })} /> Visible in store
              </label>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Product</button>
              <button type="button" onClick={() => setProductForm(null)} className="btn btn-outline">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Coupon Modal */}
      {couponForm && (
        <Modal title="Create Promo Coupon" onClose={() => setCouponForm(null)} maxWidth="420px">
          <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input type="text" placeholder="Coupon Code (e.g. IDUKKI10) *" required value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className="search-input" style={inputStyle} />
            <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} style={inputStyle}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount (₹)</option>
            </select>
            <input type="number" min="1" step="0.01" placeholder={couponForm.discount_type === 'percentage' ? 'Discount Percentage *' : 'Discount Amount (₹) *'} required value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} className="search-input" style={inputStyle} />
            <input type="number" min="0" step="0.01" placeholder="Min Order Value (₹)" value={couponForm.min_order_amount} onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: e.target.value })} className="search-input" style={inputStyle} />
            {couponForm.discount_type === 'percentage' && (
              <input type="number" min="0" step="0.01" placeholder="Max Discount (₹, optional)" value={couponForm.max_discount_amount} onChange={(e) => setCouponForm({ ...couponForm, max_discount_amount: e.target.value })} className="search-input" style={inputStyle} />
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create Coupon</button>
              <button type="button" onClick={() => setCouponForm(null)} className="btn btn-outline">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Customer Modal */}
      {customerForm && (
        <Modal title="Edit Customer" onClose={() => setCustomerForm(null)} maxWidth="440px">
          <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input type="text" placeholder="First Name *" required value={customerForm.first_name} onChange={(e) => setCustomerForm({ ...customerForm, first_name: e.target.value })} className="search-input" style={inputStyle} />
              <input type="text" placeholder="Last Name" value={customerForm.last_name} onChange={(e) => setCustomerForm({ ...customerForm, last_name: e.target.value })} className="search-input" style={inputStyle} />
            </div>
            <input type="email" placeholder="Email *" required value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} className="search-input" style={inputStyle} />
            <input type="tel" placeholder="Phone" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} className="search-input" style={inputStyle} />
            <input type="password" placeholder="New password (leave blank to keep, min 6 chars)" autoComplete="new-password" minLength={6} value={customerForm.password} onChange={(e) => setCustomerForm({ ...customerForm, password: e.target.value })} className="search-input" style={inputStyle} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Customer</button>
              <button type="button" onClick={() => setCustomerForm(null)} className="btn btn-outline">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
