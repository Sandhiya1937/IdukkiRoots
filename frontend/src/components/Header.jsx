import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { API } from '../api';

export const Header = () => {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { cartCount, wishlist, settings = {} } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    API.request('/products/categories/all')
      .then((data) => setCategories(data))
      .catch(() => setCategories([]));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const storeName = settings?.site_name || 'idukkiroots Natural';
  const logoUrl = settings?.site_logo;

  return (
    <>
      <div className="top-bar">
        <div className="info-item">
          <i className="fas fa-truck"></i>
          <span>Free Express Shipping across India on orders over ₹{settings?.free_shipping_threshold || 499}</span>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="info-item"><i className="fas fa-shield-alt"></i> 100% Organic & Fresh</span>
          {settings?.support_phone && (
            <a href={`tel:${settings.support_phone}`} className="info-item" style={{ color: 'inherit', textDecoration: 'none' }}>
              <i className="fas fa-headset"></i> Support: {settings.support_phone}
            </a>
          )}
          {settings?.support_whatsapp && (
            <a
              href={settings.social_whatsapp || `https://wa.me/${String(settings.support_whatsapp).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="info-item"
              style={{ color: '#25D366', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <i className="fab fa-whatsapp"></i> WhatsApp
            </a>
          )}
          {settings?.support_hours && (
            <span className="info-item"><i className="far fa-clock"></i> {settings.support_hours}</span>
          )}
        </div>
      </div>

      <header className="main-header">
        <div className="header-container">
          <Link to="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                style={{ maxHeight: '44px', maxWidth: '190px', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.header-logo-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="header-logo-fallback"
              style={{
                display: logoUrl ? 'none' : 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}
            >
              <div className="logo-icon"><i className="fas fa-seedling"></i></div>
              <span>{storeName}</span>
            </div>
          </Link>

          <div className="search-container">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                className="search-input"
                placeholder="Search fresh cardamom, black pepper, tea, coffee, spices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="search-btn">
                <i className="fas fa-search"></i> Search
              </button>
            </form>
          </div>

          <div className="header-actions">
            {isAdmin && (
              <Link to="/admin" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                <i className="fas fa-user-shield"></i> Admin Portal
              </Link>
            )}

            <Link to="/profile" className="action-btn">
              <i className="far fa-heart"></i>
              <span>Wishlist</span>
              {wishlist.length > 0 && <span className="action-badge">{wishlist.length}</span>}
            </Link>

            <Link to="/cart" className="action-btn">
              <i className="fas fa-shopping-basket"></i>
              <span>Cart</span>
              {cartCount > 0 && <span className="action-badge">{cartCount}</span>}
            </Link>

            {isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link to="/profile" className="action-btn">
                  <i className="far fa-user"></i>
                  <span>{user?.first_name || 'Account'}</span>
                </Link>
                <button onClick={logout} className="btn btn-outline btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/register" className="action-btn">
                <i className="far fa-user"></i>
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>

        <div className="nav-category-bar">
          <div className="category-nav-container">
            <Link to="/products" className={`nav-link ${location.pathname === '/products' && !location.search ? 'active' : ''}`}>
              <i className="fas fa-th-large"></i> All Products
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                className={`nav-link ${location.search.includes(`category=${cat.id}`) ? 'active' : ''}`}
              >
                {cat.name}
              </Link>
            ))}
            <Link to="/orders" className="nav-link" style={{ marginLeft: 'auto', color: 'var(--accent-gold)' }}>
              <i className="fas fa-shipping-fast"></i> Track Order
            </Link>
          </div>
        </div>
      </header>
    </>
  );
};
