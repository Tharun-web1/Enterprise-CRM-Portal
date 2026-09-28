import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Lock, CheckCircle, AlertCircle, ArrowRight, Key } from 'lucide-react';
import './ForceChangePasswordModal.css';

const ForceChangePasswordModal = () => {
  const { user, updateUser } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Only render if user exists and is_first_login is true
  if (!user || !user.is_first_login) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match. Please verify and try again.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/users/change-password/', {
        old_password: oldPassword,
        new_password: newPassword
      });

      const updatedUser = res.data?.user || { ...user, is_first_login: false };

      // Update LocalStorage and AuthContext state
      updateUser(updatedUser);

      setSuccessMsg('Password updated successfully! Access granted.');
    } catch (err) {
      const msg = err.response?.data?.error || JSON.stringify(err.response?.data || err.message);
      setErrorMsg('Failed to update password: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="force-password-overlay">
      <div className="force-password-card">
        
        {/* Header Icon & Title */}
        <div className="force-password-header">
          <div className="force-password-icon">
            <ShieldAlert size={32} color="#f59e0b" />
          </div>
          <h3>First Time Login Requirement</h3>
          <p>
            Welcome <strong>{user.first_name ? `${user.first_name} ${user.last_name}` : user.username}</strong>!
            For system security, you must update your assigned temporary password before continuing into the portal.
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="force-alert error">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="force-alert success">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="force-password-form">
          <div className="form-group">
            <label className="form-label">Temporary / Current Password *</label>
            <div className="input-with-icon">
              <Key size={16} className="input-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="Enter current password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">New Secure Password *</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary force-submit-btn"
            disabled={loading}
          >
            <span>{loading ? 'Updating Password...' : 'Update Password & Access Portal'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

      </div>
    </div>
  );
};

export default ForceChangePasswordModal;
