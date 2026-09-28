import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import './NotificationModal.css';

const NotificationModal = ({ modalState, onClose }) => {
  const {
    isOpen,
    type = 'success',
    title,
    message,
    details = [],
    confirmText,
    cancelText = 'Cancel',
    confirmVariant = 'danger',
    onConfirm
  } = modalState || {};

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirmAction = () => {
    onClose();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  };

  const renderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={38} strokeWidth={2.2} />;
      case 'error':
        return <XCircle size={38} strokeWidth={2.2} />;
      case 'warning':
        return <AlertTriangle size={38} strokeWidth={2.2} />;
      case 'confirm':
        return <ShieldAlert size={38} strokeWidth={2.2} />;
      default:
        return <CheckCircle size={38} strokeWidth={2.2} />;
    }
  };

  return (
    <div className="notify-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="notify-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className={`notify-top-accent ${type}`} />
        
        <div className={`notify-icon-circle ${type}`}>
          {renderIcon()}
        </div>

        <h3 className="notify-title">{title}</h3>
        {message && <p className="notify-message">{message}</p>}

        {details && details.length > 0 && (
          <div className="notify-details-container">
            {details.map((detail, idx) => (
              <div key={idx} className="notify-detail-line">
                <span className="notify-bullet">•</span>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        )}

        <div className="notify-actions">
          {type === 'confirm' ? (
            <>
              <button
                type="button"
                className="notify-btn secondary"
                onClick={onClose}
              >
                {cancelText}
              </button>
              <button
                type="button"
                className={`notify-btn ${confirmVariant === 'danger' ? 'danger' : 'primary'}`}
                onClick={handleConfirmAction}
                autoFocus
              >
                {confirmText || 'Confirm'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`notify-btn full-width ${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'primary'}`}
              onClick={onClose}
              autoFocus
            >
              {confirmText || (type === 'error' ? 'Dismiss' : 'Got It')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
