import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000/api';
  }
  if (window.location.hostname.includes('rrgobalitservices.com')) {
    return `${window.location.protocol}//${window.location.hostname}/api`;
  }
  if (window.location.hostname.includes('ygrgobalitservices.com')) {
    return `${window.location.protocol}//demo.ygrgobalitservices.com/api`;
  }
  return '/api';
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add Authorization Bearer token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle expired tokens, authentication errors, and port auto-switch
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Auto-retry port fallback (toggle between 8000 and 8001) on connection refusal
    if (!error.response && originalRequest && !originalRequest._retryPort) {
      originalRequest._retryPort = true;
      const currentUrl = originalRequest.baseURL || api.defaults.baseURL || '';
      let altUrl = null;
      if (currentUrl.includes('127.0.0.1:8000') || currentUrl.includes('localhost:8000')) {
        altUrl = currentUrl.replace('8000', '8001');
      } else if (currentUrl.includes('127.0.0.1:8001') || currentUrl.includes('localhost:8001')) {
        altUrl = currentUrl.replace('8001', '8000');
      }

      if (altUrl) {
        api.defaults.baseURL = altUrl;
        originalRequest.baseURL = altUrl;
        if (originalRequest.url && originalRequest.url.startsWith('http')) {
          originalRequest.url = originalRequest.url.includes('8000') 
            ? originalRequest.url.replace('8000', '8001') 
            : originalRequest.url.replace('8001', '8000');
        }
        try {
          return await api(originalRequest);
        } catch (retryErr) {
          return Promise.reject(retryErr);
        }
      }
    }

    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

