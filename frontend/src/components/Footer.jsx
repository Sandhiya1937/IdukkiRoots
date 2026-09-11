import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer style={{ background: 'var(--secondary)', color: '#94a3b8', padding: '3.5rem 1.5rem 1.5rem', marginTop: '4rem', borderTop: '1px solid var(--border-color)' }}>
      <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2.5rem' }}>
        <div>
          <div className="logo" style={{ color: '#ffffff', marginBottom: '1rem' }}>
            <div className="logo-icon"><i className="fas fa-seedling"></i></div>
            <span>IdukkiRoots</span>
          </div>
          <p style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
            Sourced directly from the high ranges of Idukki, Kerala. Premium green cardamom, black pepper, authentic tea, and hill produce delivered fresh to your doorstep.
          </p>
        </div>

        <div>
          <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1rem' }}>Quick Links</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <Link to="/products" style={{ color: 'inherit' }}>All Spices & Tea</Link>
            <Link to="/orders" style={{ color: 'inherit' }}>Order Tracking</Link>
            <Link to="/profile" style={{ color: 'inherit' }}>My Account</Link>
            <Link to="/cart" style={{ color: 'inherit' }}>Shopping Cart</Link>
          </div>
        </div>

        <div>
          <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1rem' }}>Customer Care</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <span><i className="fas fa-phone-alt"></i> +91 98470 12345</span>
            <span><i className="fas fa-envelope"></i> support@idukkiroots.com</span>
            <span><i className="fas fa-map-marker-alt"></i> Kattappana, Idukki, Kerala - 685508</span>
          </div>
        </div>

        <div>
          <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1rem' }}>Secure Payments</h4>
          <p style={{ fontSize: '0.825rem', marginBottom: '1rem' }}>Accepting all major payment modes across India</p>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '1.6rem', color: '#cbd5e1' }}>
            <i className="fab fa-cc-visa"></i>
            <i className="fab fa-cc-mastercard"></i>
            <i className="fas fa-mobile-alt"></i>
            <i className="fas fa-university"></i>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '2.5rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        © {new Date().getFullYear()} IdukkiRoots Spices & Agri Producer Co. All Rights Reserved.
      </div>
    </footer>
  );
};
