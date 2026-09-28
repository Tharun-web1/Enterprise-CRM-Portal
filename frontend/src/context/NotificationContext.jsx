import React, { createContext, useContext, useState, useCallback } from 'react';
import NotificationModal from '../components/NotificationModal';

const NotificationContext = createContext();

/**
 * Utility to extract clean, human-friendly error messages and bullet point details
 * from Axios or Django REST Framework error responses.
 */
export const formatApiError = (err, fallbackMessage = 'An unexpected error occurred.') => {
  if (!err) return { message: fallbackMessage, details: [] };
  if (typeof err === 'string') return { message: err, details: [] };

  const resData = err.response?.data;
  if (!resData) {
    return { message: err.message || fallbackMessage, details: [] };
  }

  if (typeof resData === 'string') {
    return { message: resData, details: [] };
  }

  let message = resData.detail || resData.error || resData.message;
  const details = [];

  if (typeof resData === 'object' && !Array.isArray(resData)) {
    Object.entries(resData).forEach(([field, errors]) => {
      if (['detail', 'error', 'message'].includes(field)) return;
      const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (Array.isArray(errors)) {
        errors.forEach(e => {
          const errText = typeof e === 'object' ? JSON.stringify(e) : String(e);
          details.push(`${fieldLabel}: ${errText}`);
        });
      } else if (typeof errors === 'string') {
        details.push(`${fieldLabel}: ${errors}`);
      } else if (typeof errors === 'object' && errors !== null) {
        details.push(`${fieldLabel}: ${JSON.stringify(errors)}`);
      }
    });
  } else if (Array.isArray(resData)) {
    resData.forEach(item => {
      details.push(typeof item === 'object' ? JSON.stringify(item) : String(item));
    });
  }

  if (!message) {
    if (details.length > 0) {
      message = details.length === 1 ? details[0] : 'Please correct the highlighted errors.';
    } else {
      message = fallbackMessage;
    }
  }

  return { message, details };
};

export const NotificationProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'success', // 'success' | 'error' | 'warning' | 'confirm'
    title: '',
    message: '',
    details: [],
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmVariant: 'danger', // 'danger' | 'primary'
    onConfirm: null
  });

  const showNotify = useCallback(({
    type = 'success',
    title,
    message,
    details = [],
    confirmText,
    cancelText = 'Cancel',
    confirmVariant = 'primary',
    onConfirm = null
  }) => {
    const defaultTitle = 
      type === 'success' ? 'Success' :
      type === 'error' ? 'Action Failed' :
      type === 'warning' ? 'Attention' : 'Confirm Action';

    setModalState({
      isOpen: true,
      type,
      title: title || defaultTitle,
      message: message || '',
      details: Array.isArray(details) ? details : (details ? [details] : []),
      confirmText: confirmText || (type === 'confirm' ? 'Confirm' : 'Got It'),
      cancelText,
      confirmVariant,
      onConfirm
    });
  }, []);

  const showSuccess = useCallback(({ title = 'Success', message, details = [], buttonText = 'Got It' }) => {
    showNotify({
      type: 'success',
      title,
      message,
      details,
      confirmText: buttonText
    });
  }, [showNotify]);

  const showError = useCallback(({ title = 'Operation Failed', message, details = [], error = null, buttonText = 'Dismiss' }) => {
    let finalMessage = message;
    let finalDetails = Array.isArray(details) ? [...details] : (details ? [details] : []);

    if (error) {
      const parsed = formatApiError(error, message || 'An unexpected error occurred.');
      if (!finalMessage) finalMessage = parsed.message;
      if (parsed.details && parsed.details.length > 0) {
        parsed.details.forEach(d => {
          if (!finalDetails.includes(d)) finalDetails.push(d);
        });
      }
    }

    showNotify({
      type: 'error',
      title,
      message: finalMessage || 'Could not complete the requested action.',
      details: finalDetails,
      confirmText: buttonText
    });
  }, [showNotify]);

  const showWarning = useCallback(({ title = 'Warning', message, details = [], buttonText = 'Understood' }) => {
    showNotify({
      type: 'warning',
      title,
      message,
      details,
      confirmText: buttonText
    });
  }, [showNotify]);

  const showConfirm = useCallback(({
    title = 'Confirm Action',
    message,
    details = [],
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'danger',
    onConfirm
  }) => {
    showNotify({
      type: 'confirm',
      title,
      message,
      details,
      confirmText,
      cancelText,
      confirmVariant,
      onConfirm
    });
  }, [showNotify]);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        showNotify,
        showSuccess,
        showError,
        showWarning,
        showConfirm,
        formatApiError,
        closeModal
      }}
    >
      {children}
      <NotificationModal modalState={modalState} onClose={closeModal} />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
