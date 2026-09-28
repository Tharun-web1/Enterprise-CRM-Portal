import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const user = await login(username, password);
      redirectByRole(user.role);
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    }
  };

  const redirectByRole = (role) => {
    if (role === 'MANAGER') {
      navigate('/manager-dashboard');
    } else if (role === 'TEAM_LEAD') {
      navigate('/team-lead-dashboard');
    } else {
      navigate('/employee-dashboard');
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card login-card">
        
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-logo-box">
            <ShieldCheck size={36} color="#6366f1" />
          </div>
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">
            Client & Relationship Management Portal
          </p>
        </div>

        {errorMessage && (
          <div className="error-banner">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username or Email</label>
            <div className="input-icon-wrapper">
              <User size={18} className="input-icon" />
              <input
                type="text"
                className="form-input input-with-icon"
                placeholder="e.g. manager"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                className="form-input input-with-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem', padding: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <>
                <Spinner size="sm" color="#ffffff" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Protected by Role-Based Access Control System
        </div>
      </div>
    </div>
  );
};

export default Login;
