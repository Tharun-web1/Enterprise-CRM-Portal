import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MessengerProvider } from './context/MessengerContext';
import { NotificationProvider } from './context/NotificationContext';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import TeamLeadDashboard from './pages/TeamLeadDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ForceChangePasswordModal from './components/ForceChangePasswordModal';
import { SkeletonCard, SkeletonStats } from './components/Skeleton';
import './index.css';

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="layout-wrapper" style={{ padding: '2rem' }}>
        <SkeletonStats count={3} />
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    // Redirect user to their own role dashboard
    if (user.role === 'MANAGER') return <Navigate to="/manager-dashboard" replace />;
    if (user.role === 'TEAM_LEAD') return <Navigate to="/team-lead-dashboard" replace />;
    return <Navigate to="/employee-dashboard" replace />;
  }

  return children;
};

const RootRedirect = () => {
  const { user, authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="layout-wrapper" style={{ padding: '2rem' }}>
        <SkeletonStats count={3} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'MANAGER') return <Navigate to="/manager-dashboard" replace />;
  if (user.role === 'TEAM_LEAD') return <Navigate to="/team-lead-dashboard" replace />;
  return <Navigate to="/employee-dashboard" replace />;
};

const DirectTabRedirect = ({ targetTab }) => {
  const { user, authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="layout-wrapper" style={{ padding: '2rem' }}>
        <SkeletonStats count={3} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const searchParams = new URLSearchParams(window.location.search);
  searchParams.set('tab', targetTab);
  const searchStr = `?${searchParams.toString()}`;

  if (user.role === 'MANAGER') return <Navigate to={`/manager-dashboard${searchStr}`} replace />;
  if (user.role === 'TEAM_LEAD') return <Navigate to={`/team-lead-dashboard${searchStr}`} replace />;
  return <Navigate to={`/employee-dashboard${searchStr}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MessengerProvider>
          <ForceChangePasswordModal />
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/manager-dashboard"
                element={
                  <ProtectedRoute allowedRole="MANAGER">
                    <ManagerDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/team-lead-dashboard"
                element={
                  <ProtectedRoute allowedRole="TEAM_LEAD">
                    <TeamLeadDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/employee-dashboard"
                element={
                  <ProtectedRoute allowedRole="EMPLOYEE">
                    <EmployeeDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/messenger"
                element={
                  <ProtectedRoute>
                    <DirectTabRedirect targetTab="messenger" />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <DirectTabRedirect targetTab="profile" />
                  </ProtectedRoute>
                }
              />

              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </MessengerProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
