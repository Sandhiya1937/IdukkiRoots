import React from 'react';

export const StarRating = ({ rating = 0, count = null }) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      stars.push(<i key={i} className="fas fa-star"></i>);
    } else if (i === fullStars + 1 && hasHalf) {
      stars.push(<i key={i} className="fas fa-star-half-alt"></i>);
    } else {
      stars.push(<i key={i} className="far fa-star"></i>);
    }
  }

  return (
    <div className="rating-row">
      <span className="stars">{stars}</span>
      <span style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.8rem' }}>{Number(rating).toFixed(1)}</span>
      {count !== null && <span className="rating-count">({count})</span>}
    </div>
  );
};
