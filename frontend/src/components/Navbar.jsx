import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import BrandLogo from './BrandLogo';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();

  const getRoleClass = (role) => {
    switch (role) {
      case 'MANAGER':
        return 'role-manager';
      case 'TEAM_LEAD':
        return 'role-team-lead';
      default:
        return 'role-employee';
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'MANAGER':
        return 'Manager (Admin)';
      case 'TEAM_LEAD':
        return 'Team Lead';
      default:
        return 'Employee';
    }
  };

  return (
    <header className="navbar">
      <div className="nav-brand">
        <BrandLogo size="normal" />
      </div>

      {user && (
        <div className="nav-user">
          <div className="user-info">
            <span className="user-name">{user.first_name ? `${user.first_name} ${user.last_name}` : user.username}</span>
            <span className={`user-role-badge ${getRoleClass(user.role)}`}>
              {getRoleDisplay(user.role)}
            </span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={logout} title="Log Out">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
