import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ProductCard } from '../components/ProductCard';
import { API } from '../api';

const emptyAddress = { full_name: '', phone: '', address_line1: '', city: '', state: 'Kerala', postal_code: '', is_default: false };
const inputStyle = { border: '1px solid var(--border-color)', padding: '0.6rem' };

export const ProfilePage = () => {
  const { user } = useAuth();
  const { wishlist } = useCart();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState(user);
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [addresses, setAddresses] = useState([]);
  const [newAddr, setNewAddr] = useState(emptyAddress);

  useEffect(() => {
    // The stored login user has no phone number, so load the full profile
    API.request('/auth/me')
      .then((data) => setProfile(data))
      .catch(() => {});
    API.request('/auth/addresses')
      .then((data) => setAddresses(data))
      .catch(() => setAddresses([]));
  }, []);

  const startEditing = () => {
    setProfileForm({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || ''
    });
    setEditing(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const payload = {
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
      phone: profileForm.phone.trim() || null
    };
    try {
      await API.request('/auth/me', { method: 'PUT', body: JSON.stringify(payload) });
      setProfile({ ...profile, ...payload });
      // Keep the header greeting in sync with the new name
      const stored = API.getUser() || {};
      localStorage.setItem('user', JSON.stringify({ ...stored, first_name: payload.first_name, last_name: payload.last_name }));
      window.dispatchEvent(new Event('auth-change'));
      setEditing(false);
      API.showToast('Profile updated', 'success');
    } catch (err) {
      API.showToast(err.message, 'danger');
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await API.request('/auth/addresses', {
        method: 'POST',
        body: JSON.stringify(newAddr)
      });
      const updated = await API.request('/auth/addresses');
      setAddresses(updated);
      setNewAddr(emptyAddress);
      API.showToast('Address added!', 'success');
    } catch (err) {
      API.showToast(err.message, 'danger');
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      await API.request(`/auth/address/${id}`, { method: 'DELETE' });
      setAddresses(addresses.filter((a) => a.id !== id));
      API.showToast('Address removed', 'info');
    } catch (err) {
      API.showToast(err.message, 'danger');
    }
  };

  const tabButtonStyle = (tab) => ({
    padding: '0.75rem 1rem',
    border: 'none',
    borderRadius: '6px',
    background: activeTab === tab ? 'var(--primary-light)' : 'transparent',
    color: activeTab === tab ? 'var(--primary-dark)' : 'var(--secondary)',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer'
  });

  return (
    <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <h2 style={{ fontSize: '1.6rem', color: 'var(--secondary)', marginBottom: '1.5rem' }}>My Account</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '2rem' }}>
        {/* Sidebar Navigation */}
        <div style={{ background: 'var(--bg-surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button onClick={() => setActiveTab('profile')} style={tabButtonStyle('profile')}>
              <i className="far fa-user" style={{ marginRight: '0.5rem' }}></i> Profile Details
            </button>
            <button onClick={() => setActiveTab('addresses')} style={tabButtonStyle('addresses')}>
              <i className="fas fa-map-marker-alt" style={{ marginRight: '0.5rem' }}></i> Saved Addresses
            </button>
            <button onClick={() => setActiveTab('wishlist')} style={tabButtonStyle('wishlist')}>
              <i className="far fa-heart" style={{ marginRight: '0.5rem' }}></i> Wishlist ({wishlist.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          {activeTab === 'profile' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem' }}>Personal Information</h3>
                {!editing && (
                  <button onClick={startEditing} className="btn btn-outline btn-sm"><i className="fas fa-pen"></i> Edit</button>
                )}
              </div>

              {editing ? (
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="text" placeholder="First Name *" required value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} className="search-input" style={inputStyle} />
                    <input type="text" placeholder="Last Name" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} className="search-input" style={inputStyle} />
                  </div>
                  <input type="tel" placeholder="Phone Number" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="search-input" style={inputStyle} />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
                    <button type="button" onClick={() => setEditing(false)} className="btn btn-outline btn-sm">Cancel</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.95rem' }}>
                  <div><strong>First Name:</strong> {profile?.first_name || 'N/A'}</div>
                  <div><strong>Last Name:</strong> {profile?.last_name || 'N/A'}</div>
                  <div><strong>Email Address:</strong> {profile?.email}</div>
                  <div><strong>Phone Number:</strong> {profile?.phone || 'Not provided'}</div>
                  <div><strong>Role:</strong> <span className="badge badge-info">{profile?.role?.toUpperCase()}</span></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Manage Delivery Addresses</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {addresses.map((a) => (
                  <div key={a.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', position: 'relative' }}>
                    <strong>{a.full_name}</strong> ({a.phone})
                    {a.is_default && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>DEFAULT</span>}
                    <br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {a.address_line1}, {a.city}, {a.state} - {a.postal_code}
                    </span>
                    <button onClick={() => handleDeleteAddress(a.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                      <i className="far fa-trash-alt"></i>
                    </button>
                  </div>
                ))}
              </div>

              <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Add New Address</h4>
              <form onSubmit={handleAddAddress} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px' }}>
                <input type="text" placeholder="Full Name *" required value={newAddr.full_name} onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })} className="search-input" style={inputStyle} />
                <input type="tel" placeholder="Phone Number *" required value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} className="search-input" style={inputStyle} />
                <input type="text" placeholder="Address Line *" required value={newAddr.address_line1} onChange={(e) => setNewAddr({ ...newAddr, address_line1: e.target.value })} className="search-input" style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <input type="text" placeholder="City *" required value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="search-input" style={inputStyle} />
                  <input type="text" placeholder="State *" required value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} className="search-input" style={inputStyle} />
                  <input type="text" placeholder="Pincode *" required value={newAddr.postal_code} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} className="search-input" style={inputStyle} />
                </div>
                <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={newAddr.is_default} onChange={(e) => setNewAddr({ ...newAddr, is_default: e.target.checked })} /> Set as default address
                </label>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: 'fit-content' }}>Save Address</button>
              </form>
            </div>
          )}

          {activeTab === 'wishlist' && (
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Saved Wishlist Items ({wishlist.length})</h3>
              {wishlist.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No saved items in wishlist.</p>
              ) : (
                <div className="product-grid">
                  {/* Wishlist rows carry the product's default variant (variant_id, price, weight) */}
                  {wishlist.map((item) => (
                    <ProductCard key={item.product_id} product={{ ...item, id: item.product_id }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
