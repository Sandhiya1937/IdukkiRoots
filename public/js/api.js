/* ==========================================================================
   IdukkiRoots Frontend API Client & State Manager
   ========================================================================== */

const API_BASE = '/api';

const API = {
    // Auth Helpers
    getToken() {
        return localStorage.getItem('token');
    },
    setToken(token) {
        localStorage.setItem('token', token);
    },
    removeToken() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },
    getUser() {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch(e) { return null; }
    },
    setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    },
    isLoggedIn() {
        return !!this.getToken();
    },
    isAdmin() {
        const u = this.getUser();
        return u && u.role === 'admin';
    },

    // Global Fetch Wrapper
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);
            
            if (response.status === 401 && !endpoint.includes('/auth/login')) {
                this.removeToken();
                window.dispatchEvent(new Event('auth-changed'));
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    // Auth Services
    async login(email, password) {
        const res = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.setToken(res.token);
        this.setUser(res.user);
        await this.syncCart();
        window.dispatchEvent(new Event('auth-changed'));
        return res;
    },

    async register(userData) {
        const res = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        this.setToken(res.token);
        this.setUser(res.user);
        await this.syncCart();
        window.dispatchEvent(new Event('auth-changed'));
        return res;
    },

    async googleLogin(credential, profileData = null) {
        const res = await this.request('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential, profile: profileData })
        });
        this.setToken(res.token);
        this.setUser(res.user);
        await this.syncCart();
        window.dispatchEvent(new Event('auth-changed'));
        return res;
    },

    logout() {
        this.removeToken();
        localStorage.removeItem('local_cart');
        window.dispatchEvent(new Event('auth-changed'));
        window.location.href = '/';
    },

    // Cart Management
    getLocalCart() {
        try {
            return JSON.parse(localStorage.getItem('local_cart')) || [];
        } catch(e) { return []; }
    },

    setLocalCart(cart) {
        localStorage.setItem('local_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cart-changed'));
    },

    async getCart() {
        if (this.isLoggedIn()) {
            return await this.request('/cart');
        } else {
            return this.getLocalCart();
        }
    },

    async addToCart(variantId, quantity = 1, productDetails = {}) {
        if (this.isLoggedIn()) {
            await this.request('/cart', {
                method: 'POST',
                body: JSON.stringify({ variant_id: variantId, quantity })
            });
            window.dispatchEvent(new Event('cart-changed'));
        } else {
            let cart = this.getLocalCart();
            const existingIdx = cart.findIndex(item => item.variant_id === variantId);
            if (existingIdx > -1) {
                cart[existingIdx].quantity += quantity;
            } else {
                cart.push({
                    variant_id: variantId,
                    quantity: quantity,
                    product_name: productDetails.name || 'Product',
                    price: productDetails.price || 0,
                    image: productDetails.image || '',
                    variant_details: productDetails.variant_details || ''
                });
            }
            this.setLocalCart(cart);
        }
        this.showToast('Item added to cart!', 'success');
    },

    async updateCartQuantity(variantId, quantity) {
        if (this.isLoggedIn()) {
            await this.request('/cart', {
                method: 'POST',
                body: JSON.stringify({ variant_id: variantId, quantity })
            });
        } else {
            let cart = this.getLocalCart();
            if (quantity <= 0) {
                cart = cart.filter(item => item.variant_id !== variantId);
            } else {
                const item = cart.find(i => i.variant_id === variantId);
                if (item) item.quantity = quantity;
            }
            this.setLocalCart(cart);
        }
        window.dispatchEvent(new Event('cart-changed'));
    },

    async syncCart() {
        if (!this.isLoggedIn()) return;
        const localCart = this.getLocalCart();
        if (localCart.length > 0) {
            try {
                await this.request('/cart/sync', {
                    method: 'POST',
                    body: JSON.stringify({ localCart })
                });
                localStorage.removeItem('local_cart');
                window.dispatchEvent(new Event('cart-changed'));
            } catch (err) {
                console.error('Failed to sync cart:', err);
            }
        }
    },

    // Wishlist Management
    async toggleWishlist(productId) {
        if (!this.isLoggedIn()) {
            this.showToast('Please log in to manage your wishlist.', 'warning');
            window.location.href = '/register.html';
            return;
        }
        const res = await this.request('/wishlist/toggle', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId })
        });
        this.showToast(res.message, res.added ? 'success' : 'info');
        window.dispatchEvent(new Event('wishlist-changed'));
        return res;
    },

    // Format Helpers
    formatCurrency(amount) {
        return '₹' + parseFloat(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    renderStars(rating) {
        const fullStars = Math.floor(rating || 0);
        const hasHalf = (rating || 0) - fullStars >= 0.5;
        let starsHtml = '';
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                starsHtml += '<i class="fas fa-star"></i>';
            } else if (i === fullStars && hasHalf) {
                starsHtml += '<i class="fas fa-star-half-alt"></i>';
            } else {
                starsHtml += '<i class="far fa-star"></i>';
            }
        }
        return starsHtml;
    },

    // Toast UI Notification System
    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const bg = type === 'success' ? '#10b981' : type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#0d9488';
        toast.style.cssText = `background:${bg};color:#ffffff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:0.9rem;font-weight:600;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease;`;
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'danger' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> <span>${message}</span>`;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
};

// Global Google OAuth Client Callback Handler
window.handleGoogleCredentialResponse = async function(response) {
    try {
        await API.googleLogin(response.credential);
        API.showToast('Logged in with Google successfully!', 'success');
        setTimeout(() => {
            window.location.href = API.isAdmin() ? '/admin/index.html' : '/';
        }, 500);
    } catch (err) {
        API.showToast(err.message || 'Google Sign-In failed', 'danger');
    }
};

// Expose API globally
window.API = API;
