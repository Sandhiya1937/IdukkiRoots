import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { StarRating } from '../components/StarRating';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { API } from '../api';

const MAX_QTY = 10;

export const ProductDetailsPage = () => {
  const { id } = useParams();
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const { isLoggedIn, user } = useAuth();

  const [product, setProduct] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [selectedImage, setSelectedImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  // Review Form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // GET /products/:id/reviews returns { reviews, aggregate }
  const loadReviews = (productId) =>
    API.request(`/products/${productId}/reviews`)
      .then((data) => setReviews(Array.isArray(data) ? data : data?.reviews || []))
      .catch(() => setReviews([]));

  useEffect(() => {
    setLoading(true);
    setQuantity(1);
    API.request(`/products/${id}`)
      .then((data) => {
        setProduct(data);
        const vars = data.variants || [];
        setSelectedVariantId(vars.length > 0 ? vars[0].id : null);
        const imgs = data.images || [];
        setSelectedImage(imgs[0]?.image_url || data.image_url || '/uploads/placeholder.jpg');
        // Related products come back on the product payload
        setRecommendations(data.recommendations || []);
        setLoading(false);
        loadReviews(data.id);
      })
      .catch(() => {
        setProduct(null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
        <i className="fas fa-spinner fa-spin fa-2x"></i><br /><br />Loading product details...
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem' }}>
        <h2>Product Not Found</h2>
      </div>
    );
  }

  const variants = product.variants || [];
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || variants[0] || {};
  const currentPrice = API.toNumber(selectedVariant.price ?? product.price);
  const mrpPrice = API.toNumber(selectedVariant.mrp ?? product.mrp);
  const stock = selectedVariant.stock !== undefined && selectedVariant.stock !== null ? Number(selectedVariant.stock) : null;
  const outOfStock = stock !== null && stock <= 0;
  const maxQty = stock !== null ? Math.max(1, Math.min(MAX_QTY, stock)) : MAX_QTY;
  const images = product.images && product.images.length > 0 ? product.images : [{ id: 1, image_url: product.image_url }];

  const handleAddToCart = () => {
    if (!selectedVariant.id || outOfStock) return;
    addToCart(selectedVariant.id, quantity, {
      name: product.name,
      weight_value: selectedVariant.weight_value,
      weight_unit: selectedVariant.weight_unit,
      price: currentPrice,
      image_url: selectedImage
    });
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      API.showToast('Please login to write a review', 'info');
      return;
    }
    const userName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Customer';
    try {
      await API.request(`/products/${product.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ user_name: userName, rating, comment })
      });
      API.showToast('Review submitted. Thank you!', 'success');
      setComment('');
      setRating(5);
      loadReviews(product.id);
      // Refresh the product's rating summary
      API.request(`/products/${product.id}`).then((data) => setProduct(data)).catch(() => {});
    } catch (err) {
      API.showToast(err.message || 'Failed to submit review', 'danger');
    }
  };

  return (
    <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <div className="product-details-container">
        {/* Gallery */}
        <div>
          <div className="gallery-main">
            <img src={selectedImage} alt={product.name} />
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img.image_url)}
                  className={`thumb-item ${selectedImage === img.image_url ? 'active' : ''}`}
                >
                  <img src={img.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Details Info */}
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
            {product.category_name}
          </span>
          <h1 style={{ fontSize: '1.8rem', color: 'var(--secondary)', margin: '0.3rem 0 0.6rem' }}>
            {product.name}
          </h1>

          <StarRating rating={API.toNumber(product.rating_avg) || 4.8} count={product.rating_count ?? reviews.length} />

          <div className="price-row" style={{ margin: '1.25rem 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--secondary)' }}>
              {API.formatCurrency(currentPrice)}
            </span>
            {mrpPrice > currentPrice && (
              <span className="mrp-price" style={{ fontSize: '1.1rem' }}>
                {API.formatCurrency(mrpPrice)}
              </span>
            )}
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            {product.description || 'Authentic organic produce directly sourced from high ranges of Idukki, Kerala.'}
          </p>

          {/* Variants selection */}
          {variants.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>Select Weight:</label>
              <div className="variant-selector">
                {variants.map((v) => (
                  <span
                    key={v.id}
                    onClick={() => {
                      setSelectedVariantId(v.id);
                      setQuantity(1);
                    }}
                    className={`variant-pill ${v.id === selectedVariantId ? 'active' : ''}`}
                  >
                    {API.formatWeight(v.weight_value, v.weight_unit)} - {API.formatCurrency(v.price)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quantity selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>Quantity:</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ padding: '0.4rem 0.8rem', border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', fontWeight: 700 }}>-</button>
              <span style={{ padding: '0.4rem 1rem', fontWeight: 700 }}>{quantity}</span>
              <button onClick={() => setQuantity(Math.min(maxQty, quantity + 1))} style={{ padding: '0.4rem 0.8rem', border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', fontWeight: 700 }}>+</button>
            </div>
            {outOfStock && <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}>Out of stock</span>}
            {!outOfStock && stock !== null && stock < 10 && (
              <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>Only {stock} left</span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant.id || outOfStock}
              className="btn btn-primary"
              style={{ flex: 1, height: '48px', opacity: !selectedVariant.id || outOfStock ? 0.6 : 1 }}
            >
              {outOfStock ? 'Out of Stock' : <><i className="fas fa-cart-plus"></i> Add to Cart</>}
            </button>
            <button
              onClick={() => toggleWishlist(product.id)}
              className={`btn btn-outline ${isInWishlist(product.id) ? 'active' : ''}`}
              style={{ width: '48px', height: '48px', padding: 0 }}
            >
              <i className={isInWishlist(product.id) ? 'fas fa-heart' : 'far fa-heart'}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Customer Reviews & Ratings */}
      <section style={{ marginTop: '3rem', background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1.3rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>Customer Reviews ({reviews.length})</h3>

        {/* Submit Review */}
        <form onSubmit={handleReviewSubmit} style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Write a Review</h4>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.2rem', cursor: 'pointer' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <i key={s} onClick={() => setRating(s)} className={s <= rating ? 'fas fa-star' : 'far fa-star'} style={{ color: 'var(--accent-gold)' }}></i>
            ))}
          </div>
          <textarea
            rows="3"
            required
            placeholder="Share your feedback about this product..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="search-input"
            style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.75rem' }}
          ></textarea>
          <button type="submit" className="btn btn-primary btn-sm">Submit Review</button>
        </form>

        {/* Reviews List */}
        {reviews.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No reviews yet. Be the first to review this product.</p>
        )}
        {reviews.map((r) => (
          <div key={r.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{r.user_name || 'Verified Buyer'}</strong>
              <StarRating rating={r.rating} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.3rem' }}>{r.comment}</p>
          </div>
        ))}
      </section>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section style={{ marginTop: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>You Might Also Like</h3>
          <div className="product-grid">
            {recommendations.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
