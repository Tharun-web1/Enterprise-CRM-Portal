import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import {
  User, Mail, Phone, Briefcase, Award, Shield, Key,
  CheckCircle, AlertCircle, Save, Sparkles, Clock, Lock
} from 'lucide-react';
import './UserProfile.css';

const UserProfile = () => {
  const { user, updateUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('details'); // 'details' | 'security'

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    designation: user?.designation || '',
    department: user?.department || '',
    skills: user?.skills || '',
    experience_years: user?.experience_years || 1,
    is_available: user?.is_available !== false
  });

  // Password Form state
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const getInitials = (u) => {
    if (!u) return 'U';
    if (u.first_name && u.last_name) {
      return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
    }
    return (u.username || 'U').slice(0, 2).toUpperCase();
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'MANAGER':
        return 'Manager / Administrator';
      case 'TEAM_LEAD':
        return 'Team Lead';
      default:
        return 'Team Employee';
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.patch('/users/me/', profileForm);
      updateUser(res.data);
      setMsg({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      setMsg({
        text: 'Error updating profile: ' + JSON.stringify(err.response?.data || err.message),
        type: 'error'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    setSavingPassword(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.post('/users/change-password/', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password
      });
      setMsg({ text: res.data?.message || 'Password changed successfully!', type: 'success' });
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setMsg({
        text: 'Password change error: ' + (err.response?.data?.error || JSON.stringify(err.response?.data || err.message)),
        type: 'error'
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="user-profile-page">

      {/* Hero Header Card */}
      <div className="profile-hero-card">
        <div className="profile-hero-banner" />
        <div className="profile-hero-content">
          <div className="profile-hero-main-row">
            <div className="profile-avatar-large">
              {getInitials(user)}
            </div>
            <div className="profile-hero-meta">
              <h2>
                {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
              </h2>
              <div className="profile-hero-tags">
                <span className="profile-badge role-badge">
                  <Shield size={13} /> {getRoleLabel(user?.role)}
                </span>
                <span className="profile-badge id-badge">
                  ID: {user?.username}
                </span>
                {user?.designation && (
                  <span className="profile-badge desig-badge">
                    <Briefcase size={13} /> {user.designation}
                  </span>
                )}
                {user?.department && (
                  <span className="profile-badge dept-badge">
                    <Award size={13} /> {user.department}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notice */}
      {msg.text && (
        <div className={`profile-alert ${msg.type}`}>
          {msg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="profile-tabs-bar">
        <button
          className={`profile-tab-btn ${activeSubTab === 'details' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('details'); setMsg({ text: '', type: '' }); }}
        >
          <User size={16} /> Personal Details
        </button>
        <button
          className={`profile-tab-btn ${activeSubTab === 'security' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('security'); setMsg({ text: '', type: '' }); }}
        >
          <Lock size={16} /> Security & Password
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="profile-tab-content">
        {activeSubTab === 'details' ? (
          <form className="profile-form-grid" onSubmit={handleProfileSubmit}>
            <div className="form-card">
              <div className="form-card-header">
                <User size={18} color="var(--primary)" />
                <span>Basic Information</span>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.first_name}
                    onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    placeholder="First Name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.last_name}
                    onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={profileForm.email}
                    onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="user@company.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.phone}
                    onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
            </div>

            <div className="form-card">
              <div className="form-card-header">
                <Briefcase size={18} color="var(--accent-violet)" />
                <span>Professional Role & Skills</span>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Designation / Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.designation}
                    onChange={e => setProfileForm({ ...profileForm, designation: e.target.value })}
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.department}
                    onChange={e => setProfileForm({ ...profileForm, department: e.target.value })}
                    placeholder="e.g. Engineering, Sales"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Skills (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.skills}
                    onChange={e => setProfileForm({ ...profileForm, skills: e.target.value })}
                    placeholder="React, Python, Django, SQL"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Years of Experience</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="50"
                    value={profileForm.experience_years}
                    onChange={e => setProfileForm({ ...profileForm, experience_years: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={profileForm.is_available}
                    onChange={e => setProfileForm({ ...profileForm, is_available: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Available for new project allocations
                  </span>
                </label>
              </div>
            </div>

            <div className="form-action-row">
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0.7rem 1.6rem', borderRadius: '12px', gap: '0.5rem', display: 'inline-flex', alignItems: 'center' }}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <>
                    <Spinner size="sm" color="#ffffff" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Profile Updates</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form className="profile-form-grid" onSubmit={handlePasswordSubmit}>
            <div className="form-card" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              <div className="form-card-header">
                <Key size={18} color="var(--accent-amber)" />
                <span>Change Password</span>
              </div>

              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.old_password}
                  onChange={e => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="Enter new password (min 6 characters)"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem', padding: '0.7rem', gap: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <>
                    <Spinner size="sm" color="#ffffff" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
};

export default UserProfile;
