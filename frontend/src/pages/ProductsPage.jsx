import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { API } from '../api';

const MAX_PRICE = 2500;

export const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state (category may be an id or a slug, e.g. from homepage banners)
  const selectedCat = searchParams.get('category') || '';
  const searchQ = searchParams.get('search') || '';
  const [selectedSubCat, setSelectedSubCat] = useState('');
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('popularity');

  useEffect(() => {
    API.request('/products/categories/all')
      .then((data) => setCategories(data))
      .catch(() => setCategories([]));
  }, []);

  // A subcategory only applies within its own category
  useEffect(() => {
    setSelectedSubCat('');
  }, [selectedCat]);

  useEffect(() => {
    setLoading(true);
    // Parameter names match GET /api/products in src/routes/products.js
    const query = new URLSearchParams();
    if (selectedCat) query.set('category', selectedCat);
    if (searchQ) query.set('q', searchQ);
    if (selectedSubCat) query.set('subcategory', selectedSubCat);
    if (maxPrice < MAX_PRICE) query.set('max_price', maxPrice);
    if (minRating > 0) query.set('min_rating', minRating);
    if (inStockOnly) query.set('in_stock', 'true');
    if (sortBy) query.set('sort', sortBy);

    API.request(`/products?${query.toString()}`)
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  }, [selectedCat, searchQ, selectedSubCat, maxPrice, minRating, inStockOnly, sortBy]);

  const activeCategory = categories.find((c) => String(c.id) === String(selectedCat) || c.slug === selectedCat);
  const activeCategoryName = activeCategory?.name || 'All Products';
  const hasFilters = selectedCat || searchQ || selectedSubCat || minRating > 0 || inStockOnly || maxPrice < MAX_PRICE;

  const selectCategory = (catId) => {
    const next = new URLSearchParams(searchParams);
    if (catId) next.set('category', catId);
    else next.delete('category');
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSelectedSubCat('');
    setMaxPrice(MAX_PRICE);
    setMinRating(0);
    setInStockOnly(false);
    setSortBy('popularity');
    setSearchParams({});
  };

  return (
    <main className="catalog-container">
      {/* Multi-Filter Sidebar */}
      <aside className="filter-sidebar">
        <div className="filter-title">
          <span><i className="fas fa-filter"></i> Filters</span>
          {hasFilters && (
            <button
              onClick={resetFilters}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Reset All
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="filter-group">
          <div className="filter-label">Categories</div>
          <label className="filter-option">
            <input type="radio" name="cat" checked={!selectedCat} onChange={() => selectCategory(null)} />
            <span>All Categories</span>
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="filter-option">
              <input
                type="radio"
                name="cat"
                checked={activeCategory?.id === cat.id}
                onChange={() => selectCategory(cat.id)}
              />
              <span>{cat.name}</span>
            </label>
          ))}
        </div>

        {/* Subcategories of the selected category */}
        {activeCategory?.subcategories?.length > 0 && (
          <div className="filter-group">
            <div className="filter-label">Subcategories</div>
            <label className="filter-option">
              <input type="radio" name="subcat" checked={!selectedSubCat} onChange={() => setSelectedSubCat('')} />
              <span>All {activeCategory.name}</span>
            </label>
            {activeCategory.subcategories.map((sub) => (
              <label key={sub.id} className="filter-option">
                <input
                  type="radio"
                  name="subcat"
                  checked={String(selectedSubCat) === String(sub.id)}
                  onChange={() => setSelectedSubCat(sub.id)}
                />
                <span>{sub.name}</span>
              </label>
            ))}
          </div>
        )}

        {/* Max Price Filter */}
        <div className="filter-group">
          <div className="filter-label">Max Price: ₹{maxPrice}{maxPrice >= MAX_PRICE ? '+' : ''}</div>
          <input
            type="range"
            min="100"
            max={MAX_PRICE}
            step="50"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
        </div>

        {/* Minimum Rating Filter */}
        <div className="filter-group">
          <div className="filter-label">Customer Rating</div>
          <label className="filter-option">
            <input type="radio" name="rating" checked={minRating === 0} onChange={() => setMinRating(0)} />
            <span>Any Rating</span>
          </label>
          {[4, 3, 2, 1].map((stars) => (
            <label key={stars} className="filter-option">
              <input
                type="radio"
                name="rating"
                checked={minRating === stars}
                onChange={() => setMinRating(stars)}
              />
              <span style={{ color: 'var(--accent-gold)' }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)} & Up</span>
            </label>
          ))}
        </div>

        {/* Stock status */}
        <div className="filter-group">
          <label className="filter-option">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            <span>In Stock Only</span>
          </label>
        </div>
      </aside>

      {/* Main Catalog View */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--secondary)' }}>
              {searchQ ? `Search Results for "${searchQ}"` : activeCategoryName}
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {products.length} organic items
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary)' }}>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="search-input"
              style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              <option value="popularity">Popularity</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <i className="fas fa-spinner fa-spin fa-2x"></i><br /><br />Loading catalog...
          </p>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <i className="fas fa-search" style={{ fontSize: '3rem', color: 'var(--text-light)', marginBottom: '1rem' }}></i>
            <h3 style={{ color: 'var(--secondary)' }}>No Products Found</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>Try adjusting your filters or search keywords.</p>
            <button onClick={resetFilters} className="btn btn-primary btn-sm">Clear All Filters</button>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
