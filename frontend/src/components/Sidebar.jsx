import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  ShieldCheck, LayoutDashboard, Users, Briefcase, Building2,
  DollarSign, LifeBuoy, LogOut, Sun, Moon, ChevronLeft, ChevronRight, Menu, X, Bell
} from 'lucide-react';
import './Sidebar.css';

import BrandLogo from './BrandLogo';
import NotificationDrawer from './NotificationDrawer';

const Sidebar = ({ activeTab, setActiveTab, navItems = [] }) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'light');

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count/');
      setUnreadNotifs(res.data.unread_count || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'MANAGER':
        return 'Manager (Admin)';
      case 'TEAM_LEAD':
        return 'Team Lead';
      default:
        return 'Employee';
    }
  };

  const getInitials = (user) => {
    if (!user) return 'U';
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.username[0].toUpperCase();
  };

  return (
    <>
      {/* Mobile Top Bar with Hamburger & Notification */}
      <div className="mobile-top-bar">
        <BrandLogo size="small" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            className="collapse-btn mobile-notif-btn"
            onClick={() => setIsNotifOpen(true)}
            aria-label="Notifications"
            style={{ position: 'relative' }}
          >
            <Bell size={20} />
            {unreadNotifs > 0 && <span className="sidebar-notif-ping-dot" />}
          </button>
          <button
            className="collapse-btn"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label="Toggle Navigation"
          >
            {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Vertical Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          {/* Brand & Collapse Header */}
          <div className="sidebar-brand">
            {!isCollapsed && (
              <BrandLogo size="normal" />
            )}
            {isCollapsed && (
              <ShieldCheck size={26} color="var(--primary)" style={{ margin: '0 auto' }} />
            )}
            <button
              className="collapse-btn desktop-only"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button
              className="collapse-btn mobile-only"
              onClick={() => setIsMobileOpen(false)}
              title="Close Navigation"
              aria-label="Close Navigation"
            >
              <X size={20} />
            </button>
          </div>

          {/* User Profile Card */}
          <div
            className={`sidebar-user-badge ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => {
              if (setActiveTab) setActiveTab('profile');
              setIsMobileOpen(false);
            }}
            title="View & Edit My Profile"
            style={{ cursor: 'pointer' }}
          >
            <div className="user-avatar">
              {getInitials(user)}
              <span className="sidebar-online-indicator" title="Active & Online" />
            </div>
            {!isCollapsed && (
              <div className="user-details">
                <span className="user-details-name">
                  {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                </span>
                <span className="user-details-role">{getRoleLabel(user?.role)}</span>
              </div>
            )}
          </div>

          {/* Notifications Button */}
          <div className="sidebar-notif-row">
            <button
              className="sidebar-notif-trigger-btn"
              onClick={() => setIsNotifOpen(true)}
              title="Notifications"
            >
              <div className="sidebar-notif-icon-wrap">
                <Bell size={18} />
                {unreadNotifs > 0 && <span className="sidebar-notif-ping-dot" />}
              </div>
              {!isCollapsed && <span>Notifications</span>}
              {!isCollapsed && unreadNotifs > 0 && (
                <span className="sidebar-notif-count-pill">{unreadNotifs}</span>
              )}
            </button>
          </div>

          {/* Vertical Navigation Links */}
          <nav>
            <ul className="sidebar-nav">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      className={`nav-item-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileOpen(false);
                      }}
                      title={item.label}
                    >
                      <div className="nav-item-left">
                        <IconComponent size={20} className="nav-icon" style={{ color: isActive ? '#fff' : 'var(--text-muted)' }} />
                        {!isCollapsed && <span>{item.label}</span>}
                      </div>
                      {!isCollapsed && item.count !== undefined && (
                        <span className="nav-count-badge">{item.count}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Switch Light/Dark Theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            {!isCollapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>

          <button className="logout-sidebar-btn" onClick={logout} title="Sign Out">
            <LogOut size={18} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* In-App Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => {
          setIsNotifOpen(false);
          fetchUnreadCount();
        }}
        onUpdate={fetchUnreadCount}
        onNavigate={(tab) => {
          let targetTab = tab;
          if (tab === 'leaves' || tab === 'attendance_leaves') {
            targetTab = user?.role === 'EMPLOYEE' ? 'leaves' : 'attendance_leaves';
          } else if (tab === 'tasks' && user?.role === 'MANAGER') {
            targetTab = 'projects';
          }
          if (setActiveTab) setActiveTab(targetTab);
          setIsMobileOpen(false);
          fetchUnreadCount();
        }}
      />
    </>
  );
};

export default Sidebar;
