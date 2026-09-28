import React, { useEffect } from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import Spinner from './Spinner';
import './LogoutConfirmationModal.css';

export const LogoutConfirmationModal = ({ isOpen, onConfirm, onCancel, isLoggingOut = false }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isLoggingOut) {
        onCancel();
      } else if (e.key === 'Enter' && !isLoggingOut) {
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm, isLoggingOut]);

  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={() => !isLoggingOut && onCancel()}>
      <div className="logout-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="logout-modal-icon-badge">
          <AlertTriangle size={32} />
        </div>

        <h3 className="logout-modal-title">Log Out of CRM Portal?</h3>
        <p className="logout-modal-description">
          Are you sure you want to end your current session? You will be redirected to the sign-in page.
        </p>

        <div className="logout-modal-actions">
          <button
            type="button"
            className="logout-btn-cancel"
            onClick={onCancel}
            disabled={isLoggingOut}
          >
            Stay Logged In
          </button>
          <button
            type="button"
            className="logout-btn-confirm"
            onClick={onConfirm}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <Spinner size="xs" color="#ffffff" />
                <span>Logging Out...</span>
              </>
            ) : (
              <>
                <LogOut size={16} />
                <span>Yes, Log Out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmationModal;
