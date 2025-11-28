
import React, { useContext } from 'react';
// FIX: Replaced namespace import for react-router-dom with a named import to resolve module export errors.
import { Navigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user } = useContext(AppContext);

  if (!user) {
    // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.currentRole)) {
    // Redirect to their default dashboard if they don't have access
    // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
