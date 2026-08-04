import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { userCanAccessRoute, getFirstAllowedRoute } from '../../lib/permissions';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based permission for current route
  const userRole = user?.role || 'admin';
  const isAllowed = userCanAccessRoute(userRole, location.pathname);

  if (!isAllowed) {
    const fallbackPath = getFirstAllowedRoute(userRole);
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}
