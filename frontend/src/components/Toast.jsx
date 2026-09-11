import React, { useState, useEffect } from 'react';

export const Toast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type } = e.detail;
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };

    window.addEventListener('toast', handleToast);
    return () => window.removeEventListener('toast', handleToast);
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : t.type === 'danger' ? 'fa-exclamation-circle' : 'fa-info-circle'}`}></i>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
};
