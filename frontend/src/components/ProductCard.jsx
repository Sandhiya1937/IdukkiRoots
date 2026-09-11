import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StarRating } from './StarRating';
import { useCart } from '../context/CartContext';
import { API } from '../api';

// Catalog, wishlist and recommendation rows carry their default variant flattened onto the product
const getVariants = (product) => {
  if (product.variants && product.variants.length > 0) return product.variants;
  if (product.variant_id) {
    return [{
      id: product.variant_id,
      price: product.price,
      mrp: product.mrp,
      stock: product.stock,
      weight_value: product.weight_value,
      weight_unit: product.weight_unit
    }];
  }
  return [];
};

export const ProductCard = ({ product }) => {
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const variants = getVariants(product);
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || null);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || variants[0] || {};
  const currentPrice = API.toNumber(selectedVariant.price ?? product.price);
  const mrpPrice = API.toNumber(selectedVariant.mrp ?? product.mrp);
  const discountPercent = mrpPrice > currentPrice ? Math.round(((mrpPrice - currentPrice) / mrpPrice) * 100) : 0;
  const outOfStock = selectedVariant.stock !== undefined && selectedVariant.stock !== null && Number(selectedVariant.stock) <= 0;
  const tag = product.custom_tag || (product.is_featured ? 'FEATURED' : null);

  const handleAddToCart = () => {
    if (!selectedVariant.id || outOfStock) return;
    addToCart(selectedVariant.id, 1, {
      name: product.name,
      weight_value: selectedVariant.weight_value,
      weight_unit: selectedVariant.weight_unit,
      price: currentPrice,
      image_url: product.image_url
    });
  };

  return (
    <div className="product-card">
      <div className="product-thumb">
        <Link to={`/product/${product.id}`}>
          <img src={product.image_url || '/uploads/placeholder.jpg'} alt={product.name} />
        </Link>

        {discountPercent > 0 && <span className="discount-badge">{discountPercent}% OFF</span>}
        {tag && <span className="tag-badge">{tag}</span>}

        <button
          onClick={() => toggleWishlist(product.id)}
          className={`wishlist-btn ${isInWishlist(product.id) ? 'active' : ''}`}
          title="Save to Wishlist"
        >
          <i className={isInWishlist(product.id) ? 'fas fa-heart' : 'far fa-heart'}></i>
        </button>
      </div>

      <div className="product-info">
        <span className="product-category">{product.category_name || 'Spices'}</span>
        <Link to={`/product/${product.id}`} className="product-title">
          {product.name}
        </Link>

        <StarRating rating={API.toNumber(product.rating_avg) || 4.5} count={product.rating_count ?? product.reviews_count ?? 0} />

        {variants.length > 1 && (
          <div className="variant-selector" style={{ margin: '0.4rem 0 0.8rem' }}>
            {variants.map((v) => (
              <span
                key={v.id}
                onClick={() => setSelectedVariantId(v.id)}
                className={`variant-pill ${v.id === selectedVariantId ? 'active' : ''}`}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              >
                {API.formatWeight(v.weight_value, v.weight_unit)}
              </span>
            ))}
          </div>
        )}

        <div className="price-row">
          <span className="current-price">{API.formatCurrency(currentPrice)}</span>
          {mrpPrice > currentPrice && <span className="mrp-price">{API.formatCurrency(mrpPrice)}</span>}
        </div>

        <div className="card-actions">
          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant.id || outOfStock}
            className="btn btn-primary btn-sm"
            style={{ width: '100%', opacity: !selectedVariant.id || outOfStock ? 0.6 : 1 }}
          >
            {outOfStock ? 'Out of Stock' : <><i className="fas fa-cart-plus"></i> Add to Cart</>}
          </button>
        </div>
      </div>
    </div>
  );
};
