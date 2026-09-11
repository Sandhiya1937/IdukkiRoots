import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { API } from '../api';

export const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    API.request('/products')
      .then((data) => setProducts(data))
      .catch(() => setProducts([]));

    API.request('/products/categories/all')
      .then((data) => setCategories(data))
      .catch(() => setCategories([]));

    // Public banner feed (/admin/banners requires an admin token)
    API.request('/products/banners')
      .then((data) => {
        if (data && data.length > 0) setBanners(data.map((b) => ({
          ...b,
          // Seeded links still point at the old static pages (/products.html?...)
          link: (b.link_url || '/products').replace(/^\/products\.html/, '/products')
        })));
        else setBanners([
          {
            id: 1,
            title: '100% Pure Green Cardamom from Idukki',
            subtitle: 'Hand-picked from organic spice plantations in Kattappana.',
            tag: 'FRESH HARVEST',
            image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
            button_text: 'Shop Spices',
            link: '/products'
          },
          {
            id: 2,
            title: 'Authentic Malabar Black Pepper',
            subtitle: 'Bold 8mm bold grains with intense natural aroma & oils.',
            tag: 'ORGANIC CERTIFIED',
            image_url: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=1200&q=80',
            button_text: 'Explore Black Pepper',
            link: '/products'
          }
        ]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners]);

  return (
    <main>
      {/* Hero Banner Carousel */}
      {banners.length > 0 && (
        <div className="hero-slider">
          {banners.map((slide, idx) => (
            <div
              key={slide.id || idx}
              className={`hero-slide ${idx === currentSlide ? 'active' : ''}`}
              style={{ backgroundImage: `url(${slide.image_url})` }}
            >
              <div className="hero-overlay"></div>
              <div className="hero-content">
                <span className="hero-tag">{slide.tag || 'SPECIAL OFFER'}</span>
                <h1 className="hero-title">{slide.title}</h1>
                <p className="hero-subtitle">{slide.subtitle}</p>
                <Link to={slide.link || '/products'} className="btn btn-primary">
                  {slide.button_text || 'Shop Now'} <i className="fas fa-arrow-right"></i>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 1.5rem' }}>
        {/* Categories Bar */}
        <section style={{ margin: '2.5rem 0' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--secondary)', marginBottom: '1.25rem' }}>
            Explore Categories
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--secondary)',
                  fontWeight: 600
                }}
              >
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  <i className="fas fa-seedling"></i>
                </div>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Flash Deals / Top Spices */}
        <section style={{ margin: '3rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Direct From Farms</span>
              <h2 style={{ fontSize: '1.6rem', color: 'var(--secondary)' }}>Top Spices & Produce</h2>
            </div>
            <Link to="/products" className="btn btn-outline btn-sm">View All Products <i className="fas fa-arrow-right"></i></Link>
          </div>

          <div className="product-grid">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Trust Badges */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', margin: '3rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}><i className="fas fa-leaf"></i></div>
            <div><h4 style={{ fontSize: '0.95rem' }}>100% Organic</h4><p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chemical-free farming from Idukki</p></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}><i className="fas fa-award"></i></div>
            <div><h4 style={{ fontSize: '0.95rem' }}>Grade A Quality</h4><p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Export quality spices</p></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}><i className="fas fa-truck-loading"></i></div>
            <div><h4 style={{ fontSize: '0.95rem' }}>Fast Shipping</h4><p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Direct dispatch within 24 hours</p></div>
          </div>
        </section>
      </div>
    </main>
  );
};
