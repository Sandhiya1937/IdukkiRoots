const API_BASE = '/api';

export const API = {
  // sessionStorage key for the coupon applied on the cart page (re-validated at checkout)
  COUPON_KEY: 'applied_coupon',

  getToken: () => localStorage.getItem('token'),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      return null;
    }
  },
  isLoggedIn: () => !!localStorage.getItem('token'),
  isAdmin: () => {
    const u = API.getUser();
    return u && u.role === 'admin';
  },

  async request(endpoint, options = {}) {
    const token = API.getToken();
    // For file uploads let the browser set the multipart Content-Type (with its boundary)
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = { ...options, headers };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.dispatchEvent(new Event('auth-change'));
        }
        throw new Error(data.error || `Error ${response.status}: Request failed`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // PostgreSQL NUMERIC columns arrive as strings ("340.00"), so compare and sum them as numbers
  toNumber(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  },

  formatWeight(value, unit = '') {
    if (value === undefined || value === null || value === '') return '';
    return `${API.toNumber(value)}${unit || ''}`;
  },

  // Mirrors the shipping rule the server applies in src/routes/orders.js
  calcShipping(subtotal, settings = {}) {
    const fee = API.toNumber(settings.shipping_charge);
    const threshold = API.toNumber(settings.free_shipping_threshold);
    if (subtotal <= 0 || (threshold > 0 && subtotal >= threshold)) return 0;
    return fee;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  },

  showToast(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));
  }
};
