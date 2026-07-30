import React from 'react';
import { useSelector } from 'react-redux';

export default function RBACGuard({ 
  children, 
  requiredRole = null, 
  module = null, 
  action = null, 
  fallback = null 
}) {
  const { user } = useSelector((state) => state.auth);

  if (!user) return fallback;

  // System Admin bypasses all role & permission checks
  if (user.role === 'System Admin') {
    return <>{children}</>;
  }

  // Role check
  if (requiredRole) {
    const rolesList = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!rolesList.includes(user.role)) {
      return fallback;
    }
  }

  // Permission check
  if (module && action) {
    const userPerms = user.permissions || {};
    const moduleActions = userPerms[module] || [];
    if (!moduleActions.includes(action)) {
      return fallback;
    }
  }

  return <>{children}</>;
}
