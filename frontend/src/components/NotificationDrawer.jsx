import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Bell, Check, Trash2, X, CheckCircle2, AlertCircle,
  Briefcase, MessageSquare, DollarSign, CalendarCheck, Sparkles, Loader2
} from 'lucide-react';
import './NotificationDrawer.css';

const NotificationDrawer = ({ isOpen, onClose, onNavigate, onUpdate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications/');
      setNotifications(res.data || []);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/mark-read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.post('/notifications/clear-all/');
      setNotifications([]);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  const handleSendTestAlert = async () => {
    try {
      setTestingAlert(true);
      const res = await api.post('/notifications/send-test/');
      if (res.data) {
        setNotifications(prev => [res.data, ...prev]);
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Failed to send test alert:', err);
    } finally {
      setTestingAlert(false);
    }
  };

  const handleClickItem = async (notif) => {
    if (!notif.is_read) {
      handleMarkRead(notif.id);
    }
    if (notif.link_tab && onNavigate) {
      onNavigate(notif.link_tab);
      onClose();
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED':
      case 'TASK_STATUS_CHANGED':
        return <CheckCircle2 size={18} className="notif-icon-blue" />;
      case 'TASK_COMMENT':
        return <MessageSquare size={18} className="notif-icon-indigo" />;
      case 'PROJECT_MEMBER_ADDED':
        return <Briefcase size={18} className="notif-icon-emerald" />;
      case 'INVOICE_GENERATED':
      case 'PAYMENT_RECEIVED':
        return <DollarSign size={18} className="notif-icon-amber" />;
      case 'LEAVE_REQUESTED':
      case 'LEAVE_STATUS_CHANGED':
        return <CalendarCheck size={18} className="notif-icon-purple" />;
      default:
        return <AlertCircle size={18} className="notif-icon-gray" />;
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!isOpen) return null;

  return (
    <>
      <div className="notif-drawer-backdrop" onClick={onClose} />
      <aside className="notif-drawer">
        <div className="notif-drawer-header">
          <div className="notif-header-title">
            <Bell size={20} className="notif-bell-icon" />
            <h3>Notifications</h3>
            {unreadCount > 0 && <span className="notif-pill-badge">{unreadCount} New</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              className="notif-test-btn"
              onClick={handleSendTestAlert}
              disabled={testingAlert}
              title="Send a sample system test notification"
            >
              {testingAlert ? <Loader2 size={13} className="spin-icon" /> : <Sparkles size={13} />}
              <span>Test Alert</span>
            </button>
            <button className="notif-close-btn" onClick={onClose} title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="notif-controls-bar">
          <div className="notif-tabs">
            <button
              className={`notif-tab-btn ${filter === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              All ({notifications.length})
            </button>
            <button
              className={`notif-tab-btn ${filter === 'UNREAD' ? 'active' : ''}`}
              onClick={() => setFilter('UNREAD')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div className="notif-actions">
            {unreadCount > 0 && (
              <button className="notif-action-btn" onClick={handleMarkAllRead} title="Mark All as Read">
                <Check size={14} />
                <span>Mark Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button className="notif-action-btn notif-clear-btn" onClick={handleClearAll} title="Clear All">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div className="notif-list-container">
          {loading && (
            <div className="notif-empty-state">
              <div className="notif-spinner" />
              <p>Loading notifications...</p>
            </div>
          )}

          {!loading && filteredNotifs.length === 0 && (
            <div className="notif-empty-state">
              <div className="notif-empty-icon-wrap">
                <Bell size={32} />
              </div>
              <h4>No notifications here</h4>
              <p>You're all caught up with your latest alerts and team updates!</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSendTestAlert}
                disabled={testingAlert}
                style={{ marginTop: '0.75rem' }}
              >
                <Sparkles size={14} /> Send a Test Notification
              </button>
            </div>
          )}

          {!loading && filteredNotifs.length > 0 && (
            <div className="notif-items-list">
              {filteredNotifs.map(notif => (
                <div
                  key={notif.id}
                  className={`notif-item-card ${!notif.is_read ? 'unread' : ''}`}
                  onClick={() => handleClickItem(notif)}
                >
                  <div className="notif-item-icon-box">
                    {getNotificationIcon(notif.notification_type)}
                  </div>
                  <div className="notif-item-content">
                    <div className="notif-item-top">
                      <h4 className="notif-item-title">{notif.title}</h4>
                      <span className="notif-item-time">{formatTimeAgo(notif.created_at)}</span>
                    </div>
                    <p className="notif-item-message">{notif.message}</p>
                    {notif.sender_details && (
                      <span className="notif-item-sender">
                        By {notif.sender_details.first_name || notif.sender_details.username}
                      </span>
                    )}
                  </div>
                  {!notif.is_read && (
                    <button
                      className="notif-mark-single-btn"
                      onClick={(e) => handleMarkRead(notif.id, e)}
                      title="Mark as Read"
                    >
                      <span className="notif-unread-dot" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default NotificationDrawer;
