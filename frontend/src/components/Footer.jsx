import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export const Footer = () => {
  const { settings = {} } = useCart();
  const storeName = settings?.site_name || 'idukkiroots Natural';
  const logoUrl = settings?.site_logo;

  const rawWhatsapp = String(settings?.support_whatsapp || '').replace(/\D/g, '');
  const whatsappUrl = settings?.social_whatsapp || (rawWhatsapp ? `https://wa.me/${rawWhatsapp}` : '');

  return (
    <footer style={{ background: 'var(--secondary)', color: '#94a3b8', padding: '3.5rem 1.5rem 1.5rem', marginTop: '4rem', borderTop: '1px solid var(--border-color)' }}>
      <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2.5rem' }}>
        
        {/* Brand & About */}
        <div>
          <div className="logo" style={{ color: '#ffffff', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeName}
                style={{ maxHeight: '46px', maxWidth: '200px', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.footer-logo-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="footer-logo-fallback"
              style={{
                display: logoUrl ? 'none' : 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '1.2rem'
              }}
            >
              <div className="logo-icon"><i className="fas fa-seedling"></i></div>
              <span>{storeName}</span>
            </div>
          </div>

          {settings?.site_tagline && (
            <p style={{ fontSize: '0.82rem', color: 'var(--accent-gold)', fontWeight: 600, marginBottom: '0.5rem' }}>
              {settings.site_tagline}
            </p>
          )}

          <p style={{ fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
            {settings?.footer_about || 'Sourced directly from the high ranges of Idukki, Kerala. Premium green cardamom, black pepper, authentic tea, and hill produce delivered fresh to your doorstep.'}
          </p>

          {/* Social Icons */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Chat on WhatsApp"
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'transform 0.2s' }}
              >
                <i className="fab fa-whatsapp" style={{ fontSize: '1.1rem' }}></i>
              </a>
            )}
            {settings?.social_instagram && (
              <a
                href={settings.social_instagram}
                target="_blank"
                rel="noopener noreferrer"
                title="Follow on Instagram"
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#E4405F', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'transform 0.2s' }}
              >
                <i className="fab fa-instagram" style={{ fontSize: '1.1rem' }}></i>
              </a>
            )}
            {settings?.social_facebook && (
              <a
                href={settings.social_facebook}
                target="_blank"
                rel="noopener noreferrer"
                title="Follow on Facebook"
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'transform 0.2s' }}
              >
                <i className="fab fa-facebook-f" style={{ fontSize: '1.1rem' }}></i>
              </a>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1rem' }}>Quick Links</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
            <Link to="/products" style={{ color: 'inherit', textDecoration: 'none' }}>All Spices & Tea</Link>
            <Link to="/orders" style={{ color: 'inherit', textDecoration: 'none' }}>Order Tracking</Link>
            <Link to="/profile" style={{ color: 'inherit', textDecoration: 'none' }}>My Account</Link>
            <Link to="/cart" style={{ color: 'inherit', textDecoration: 'none' }}>Shopping Cart</Link>
          </div>
        </div>

        {/* Below Contact Details */}
        <div>
          <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1rem' }}>Customer Care</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            {settings?.support_phone && (
              <a href={`tel:${settings.support_phone}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <i className="fas fa-phone-alt" style={{ color: 'var(--primary)', width: '16px' }}></i>
                <span>{settings.support_phone}</span>
              </a>
            )}
            {settings?.support_whatsapp && (
              <a
                href={whatsappUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
              >
                <i className="fab fa-whatsapp" style={{ color: '#25D366', width: '16px' }}></i>
                <span>{settings.support_whatsapp} (WhatsApp)</span>
              </a>
            )}
            {settings?.support_email && (
              <a href={`mailto:${settings.support_email}`} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <i className="fas fa-envelope" style={{ color: 'var(--primary)', width: '16px' }}></i>
                <span>{settings.support_email}</span>
              </a>
            )}
            {settings?.support_hours && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#cbd5e1' }}>
                <i className="far fa-clock" style={{ color: 'var(--accent-gold)', width: '16px' }}></i>
                <span>{settings.support_hours}</span>
              </div>
            )}
            {settings?.contact_address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', lineHeight: '1.5' }}>
                <i className="fas fa-map-marker-alt" style={{ color: 'var(--primary)', width: '16px', marginTop: '3px' }}></i>
                <span>{settings.contact_address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Secure Payments */}
        <div>
          <h4 style={{ color: '#ffffff', fontSize: '1rem', marginBottom: '1rem' }}>Secure Payments</h4>
          <p style={{ fontSize: '0.825rem', marginBottom: '1rem', lineHeight: '1.5' }}>
            Accepting all major payment modes across India: UPI, Cards, NetBanking.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '1.6rem', color: '#cbd5e1' }}>
            <i className="fab fa-cc-visa" title="Visa"></i>
            <i className="fab fa-cc-mastercard" title="Mastercard"></i>
            <i className="fas fa-mobile-alt" title="UPI Apps"></i>
            <i className="fas fa-university" title="Net Banking"></i>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '2.5rem auto 0', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        © {new Date().getFullYear()} {settings?.copyright_text || `${storeName}. All Rights Reserved.`}
      </div>
    </footer>
  );
};
