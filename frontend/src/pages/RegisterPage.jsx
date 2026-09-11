import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API } from '../api';

export const RegisterPage = () => {
  const { login, register, googleLogin, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Pages that send guests here (checkout, profile, orders) pass where to return after sign-in
  const redirectTo = location.state?.from || '/';

  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    // The Google Identity Services script loads async, so wait (up to ~10s) for it before rendering the button
    const initGoogle = (clientId, attempt = 0) => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        if (attempt < 50) retryTimer = setTimeout(() => initGoogle(clientId, attempt + 1), 200);
        else console.warn('Google Identity Services script did not load');
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          googleLogin(response.credential)
            .then(() => {
              API.showToast('Google Sign-In successful!', 'success');
              navigate(redirectTo, { replace: true });
            })
            .catch((err) => API.showToast(err.message, 'danger'));
        }
      });

      const btnElem = document.getElementById('googleSignInBtn');
      if (btnElem) {
        window.google.accounts.id.renderButton(btnElem, {
          theme: 'outline',
          size: 'large',
          // GSI needs a pixel width (max 400), not a percentage
          width: Math.min(btnElem.offsetWidth || 320, 400)
        });
      }
    };

    // Fetch Google Client ID dynamically from backend
    API.request('/auth/config')
      .then((data) => {
        if (data.googleClientId) initGoogle(data.googleClientId);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLoginTab) {
        await login(email, password);
        API.showToast('Welcome back!', 'success');
      } else {
        await register({ email, password, first_name: firstName, last_name: lastName, phone });
        API.showToast('Account registered successfully!', 'success');
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      API.showToast(err.message || 'Authentication failed', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: '440px', margin: '4rem auto', padding: '0 1.5rem' }}>
      <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
        {/* Tab Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setIsLoginTab(true)}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              color: isLoginTab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `3px solid ${isLoginTab ? 'var(--primary)' : 'transparent'}`,
              cursor: 'pointer'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLoginTab(false)}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              color: !isLoginTab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `3px solid ${!isLoginTab ? 'var(--primary)' : 'transparent'}`,
              cursor: 'pointer'
            }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isLoginTab && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="First Name *"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="search-input"
                  style={{ border: '1px solid var(--border-color)', padding: '0.65rem' }}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="search-input"
                  style={{ border: '1px solid var(--border-color)', padding: '0.65rem' }}
                />
              </div>
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="search-input"
                style={{ border: '1px solid var(--border-color)', padding: '0.65rem' }}
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email Address *"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="search-input"
            style={{ border: '1px solid var(--border-color)', padding: '0.65rem' }}
          />

          <input
            type="password"
            placeholder="Password *"
            required
            autoComplete={isLoginTab ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="search-input"
            style={{ border: '1px solid var(--border-color)', padding: '0.65rem' }}
          />

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: '44px', marginTop: '0.5rem' }}>
            {loading ? 'Please wait...' : isLoginTab ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: 'var(--text-light)', fontSize: '0.8rem' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
          <span style={{ padding: '0 0.5rem' }}>OR CONTINUE WITH</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
        </div>

        {/* Google OAuth Render Target */}
        <div id="googleSignInBtn" style={{ minHeight: '40px' }}></div>
      </div>
    </main>
  );
};
