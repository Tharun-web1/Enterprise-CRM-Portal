import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../services/api';
import LogoutConfirmationModal from '../components/LogoutConfirmationModal';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);

  // Logout modal state for back-button & manual logout security
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Sync user from backend on mount if logged in
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token && user?.id) {
        try {
          const response = await api.get(`/users/${user.id}/`);
          if (response.data) {
            setUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data));
          }
        } catch (err) {
          console.warn('Initial auth sync warning:', err);
        }
      }
      setAuthLoading(false);
    };
    initAuth();
  }, []);



  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/token/', { username, password });
      const { access, refresh, user: userData } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      return userData;
    } catch (err) {
      let errorMsg = 'Invalid username or password';
      if (err.response) {
        if (err.response.status === 404) {
          errorMsg = 'Backend API server unavailable (404). Please ensure Django server is running.';
        } else if (err.response.data?.detail) {
          errorMsg = err.response.data.detail;
        }
      } else if (err.request) {
        errorMsg = 'Cannot connect to server. Please ensure backend is running (python manage.py runserver).';
      }
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const newUserData = { ...prev, ...updatedData };
      localStorage.setItem('user', JSON.stringify(newUserData));
      return newUserData;
    });
  };

  const refreshUser = async () => {
    if (!user?.id) return;
    try {
      const response = await api.get(`/users/${user.id}/`);
      if (response.data) {
        updateUser(response.data);
      }
    } catch (err) {
      console.error('Error refreshing user details:', err);
    }
  };

  // Send presence heartbeat to backend
  const sendHeartbeat = useCallback(async (status = 'online') => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      await api.post('/users/heartbeat/', { status });
    } catch (_) {}
  }, []);

  // Periodic 20s heartbeat & window focus/close presence sync
  useEffect(() => {
    if (!user?.id) return;

    sendHeartbeat('online');

    const interval = setInterval(() => {
      sendHeartbeat('online');
    }, 20000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat('online');
      }
    };

    const handleBeforeUnload = () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          fetch('/api/users/offline/', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            keepalive: true
          });
        } catch (_) {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.id, sendHeartbeat]);

  const requestLogout = useCallback(() => {
    setIsLogoutModalOpen(true);
  }, []);

  const cancelLogout = useCallback(() => {
    setIsLogoutModalOpen(false);
  }, []);

  const confirmLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await api.post('/users/offline/');
    } catch (_) {}

    setTimeout(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
      window.location.href = '/login';
    }, 250);
  }, []);

  const logout = useCallback(() => {
    requestLogout();
  }, [requestLogout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authLoading,
        error,
        login,
        logout,
        requestLogout,
        cancelLogout,
        confirmLogout,
        updateUser,
        refreshUser,
        isManager: user?.role === 'MANAGER',
        isTeamLead: user?.role === 'TEAM_LEAD',
        isEmployee: user?.role === 'EMPLOYEE',
      }}
    >
      {children}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
        isLoggingOut={isLoggingOut}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


