

import React, { useContext, useEffect } from 'react';
// FIX: Replaced namespace import for react-router-dom with named imports to resolve module export errors.
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppContext, NotificationType } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import JudgeDashboard from './pages/JudgeDashboard';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import PatronDashboard from './pages/PatronDashboard';
import { JudgingForm } from './pages/JudgingForm';
import ProjectForm from './pages/ProjectForm';
import MainLayout from './components/layout/MainLayout';
import { User, UserRole } from './types';
import ProtectedRoute from './components/auth/ProtectedRoute';
// FIX: Changed to a named import for UserManagementPage to resolve the "no default export" error.
import { UserManagementPage } from './pages/UserManagementPage';
import ProjectsPage from './pages/ProjectsPage';
// FIX: Changed to a named import for ReportingPage to resolve the "no default export" error.
import { ReportingPage } from './pages/ReportingPage';
import CertificatesPage from './pages/CertificatesPage';
import MarkingGuidePage from './pages/MarkingGuidePage';
import ProfilePage from './pages/ProfilePage';
import SignUpPage from './pages/SignUpPage';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';
import CompleteProfileModal from './components/auth/CompleteProfileModal';
import InitialPasswordsPage from './pages/InitialPasswordsPage';
import LandingPage from './pages/LandingPage';
// FIX: Add Info and AlertTriangle for new notification types.
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import LoadingSpinner from './components/ui/LoadingSpinner';
// --- NEW IMPORTS ---
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';
import EditionManagerPage from './pages/EditionManagerPage'; // --- NEW ---
import BulkProgressModal from './components/ui/BulkProgressModal'; // --- NEW ---

// --- NEW NOTIFICATION COMPONENT ---
const Notification: React.FC<{ notification: NotificationType | null }> = ({ notification }) => {
    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        if (notification) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [notification]);
    
    if (!notification) return null;

    const styles = {
        success: {
            bg: 'bg-green-500',
            icon: <CheckCircle className="w-6 h-6 text-white" />,
        },
        error: {
            bg: 'bg-red-500',
            icon: <AlertCircle className="w-6 h-6 text-white" />,
        },
        // FIX: Add styles for info and warning notification types.
        info: {
            bg: 'bg-blue-500',
            icon: <Info className="w-6 h-6 text-white" />,
        },
        warning: {
            bg: 'bg-yellow-500',
            icon: <AlertTriangle className="w-6 h-6 text-white" />,
        },
    };

    return (
        <div
            className={`fixed top-5 right-5 z-[100] transition-all duration-300 ease-in-out ${
                isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
            }`}
        >
            <div
                className={`flex items-center gap-4 p-4 rounded-lg shadow-2xl text-white ${
                    styles[notification.type].bg
                }`}
            >
                {styles[notification.type].icon}
                <p className="font-semibold">{notification.message}</p>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const { user, theme, updateUser, notification, isLoading } = useContext(AppContext);

  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const ADMIN_ROLES = [
      UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
      UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN
  ];
  const JUDGE_ROLES = [UserRole.JUDGE, UserRole.COORDINATOR];
  const REPORTING_ROLES = [...ADMIN_ROLES.filter(r => r !== UserRole.SUPER_ADMIN), UserRole.PATRON];

  const isBiodataComplete = (currentUser: User | null): boolean => {
    if (!currentUser) return false;

    // Super Admin does not need to complete biodata
    if (currentUser.currentRole === UserRole.SUPER_ADMIN) {
        return true;
    }

    if (currentUser.currentRole === UserRole.PATRON) {
        return !!currentUser.name && !!currentUser.tscNumber && !!currentUser.idNumber && !!currentUser.phoneNumber && !!currentUser.school;
    }
    if ([...ADMIN_ROLES, ...JUDGE_ROLES].includes(currentUser.currentRole)) {
        return !!currentUser.name && !!currentUser.idNumber && !!currentUser.tscNumber && !!currentUser.phoneNumber && !!currentUser.school;
    }
    return true;
  };

  const handleBiodataSave = (updatedPatron: User) => {
      updateUser(updatedPatron);
  };

  const renderDashboard = () => {
    // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
    if (!user) return <Navigate to="/login" />;
    
    switch (user.currentRole) {
      case UserRole.SUPER_ADMIN:
        return <SuperAdminDashboard />;
      case UserRole.NATIONAL_ADMIN:
      case UserRole.REGIONAL_ADMIN:
      case UserRole.COUNTY_ADMIN:
      case UserRole.SUB_COUNTY_ADMIN:
        return <AdminDashboard />;
      case UserRole.COORDINATOR:
        return <CoordinatorDashboard />;
      case UserRole.JUDGE:
        return <JudgeDashboard />;
      case UserRole.PATRON:
        return <PatronDashboard />;
      default:
        // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
        return <Navigate to="/login" />;
    }
  };
  
  const allUserRoles = Object.values(UserRole);

  const renderAppContent = () => {
    // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
    if (!user) {
        return <Navigate to="/login" />;
    }
    // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
    if (user.forcePasswordChange) {
        return <Navigate to="/change-password" />;
    }

    const showBiodataModal = !isBiodataComplete(user);

    return (
        <>
            <MainLayout>
                {/* FIX: Replaced ReactRouterDOM.Routes with Routes from named import. */}
                <Routes>
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route path="/dashboard" element={renderDashboard()} />
                  
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route 
                    path="/judge/project/:projectId" 
                    element={
                      <ProtectedRoute allowedRoles={[UserRole.JUDGE, UserRole.COORDINATOR]}>
                        <JudgingForm />
                      </ProtectedRoute>
                    } 
                  />
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route 
                    path="/project/new" 
                    element={
                      <ProtectedRoute allowedRoles={[UserRole.PATRON]}>
                        <ProjectForm />
                      </ProtectedRoute>
                    } 
                  />
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route 
                    path="/project/edit/:projectId" 
                    element={
                      <ProtectedRoute allowedRoles={[UserRole.PATRON]}>
                        <ProjectForm />
                      </ProtectedRoute>
                    } 
                  />
                   {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                   <Route 
                    path="/profile" 
                    element={
                      <ProtectedRoute allowedRoles={allUserRoles}>
                        <ProfilePage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Admin Routes */}
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route 
                    path="/users" 
                    element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <UserManagementPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/settings" 
                    element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <SettingsPage />
                      </ProtectedRoute>
                    } 
                  />
                   {/* --- NEW ROUTE --- */}
                  <Route 
                    path="/editions" 
                    element={
                      <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                        <EditionManagerPage />
                      </ProtectedRoute>
                    } 
                  />
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route 
                    path="/projects" 
                    element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES.filter(r => r !== UserRole.SUPER_ADMIN)}>
                        <ProjectsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/certificates" 
                    element={
                      <ProtectedRoute allowedRoles={[...ADMIN_ROLES, UserRole.PATRON]}>
                        <CertificatesPage />
                      </ProtectedRoute>
                    } 
                  />
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route 
                    path="/reporting" 
                    element={
                      <ProtectedRoute allowedRoles={REPORTING_ROLES}>
                        <ReportingPage />
                      </ProtectedRoute>
                    } 
                  />
                   {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                   <Route 
                    path="/initial-passwords" 
                    element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <InitialPasswordsPage />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Judge/Coordinator Routes */}
                  {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
                  <Route 
                    path="/judging-guide" 
                    element={
                      <ProtectedRoute allowedRoles={[UserRole.JUDGE, UserRole.COORDINATOR]}>
                        <MarkingGuidePage />
                      </ProtectedRoute>
                    }
                  />

                  {/* FIX: Replaced ReactRouterDOM.Route and ReactRouterDOM.Navigate with components from named imports. */}
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                {/* FIX: Replaced ReactRouterDOM.Routes with Routes from named import. */}
                </Routes>
            </MainLayout>
            {showBiodataModal && (
                <CompleteProfileModal 
                    isOpen={true} 
                    onSave={handleBiodataSave}
                    isForced={true}
                />
            )}
        </>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <>
      <Notification notification={notification} />
      <BulkProgressModal />
      {/* FIX: Replaced ReactRouterDOM.HashRouter with HashRouter from named import. */}
      <HashRouter>
        {/* FIX: Replaced ReactRouterDOM.Routes with Routes from named import. */}
        <Routes>
          {/* Public Routes */}
          {/* FIX: Replaced ReactRouterDOM.Route and ReactRouterDOM.Navigate with components from named imports. */}
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
          {/* FIX: Replaced ReactRouterDOM.Route and ReactRouterDOM.Navigate with components from named imports. */}
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
          {/* FIX: Replaced ReactRouterDOM.Route and ReactRouterDOM.Navigate with components from named imports. */}
          <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <SignUpPage />} />
          
          {/* --- NEW ROUTES --- */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Special Protected Route for Password Change */}
          {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
          <Route 
            path="/change-password"
            element={
              // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
              user && user.forcePasswordChange ? <ForcePasswordChangePage /> : <Navigate to={user ? "/dashboard" : "/"} />
            }
          />

          {/* Main Authenticated App Routes */}
          {/* FIX: Replaced ReactRouterDOM.Route with Route from named import. */}
          <Route 
            path="/*"
            // FIX: Replaced ReactRouterDOM.Navigate with Navigate from named import.
            element={user ? renderAppContent() : <Navigate to="/" />}
          />
        {/* FIX: Replaced ReactRouterDOM.Routes with Routes from named import. */}
        </Routes>
      {/* FIX: Replaced ReactRouterDOM.HashRouter with HashRouter from named import. */}
      </HashRouter>
    </>
  );
};

export default App;
