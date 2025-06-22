import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { store, useAppDispatch, useAppSelector } from './store';
import { theme } from './styles/theme';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { UserProfile } from './pages/UserProfile';
import { SessionManagement } from './pages/SessionManagement';
import { AdminPanel } from './pages/AdminPanel';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { fetchCurrentUser } from './features/auth/authSlice';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAppSelector((state) => state.auth);
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (token && !user) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, token, user]);

  return (
    <Router>
      <Routes>
        {/* Authentication routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="sessions" element={<SessionManagement />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="" element={<Navigate to="/dashboard" replace />} />
          
          {/* Project routes */}
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="threat-models" element={<div>Threat Models Page (Coming Soon)</div>} />
          <Route path="reports" element={<div>Reports Page (Coming Soon)</div>} />
          <Route path="analytics" element={<div>Analytics Page (Coming Soon)</div>} />
          <Route path="team" element={<div>Team Page (Coming Soon)</div>} />
          <Route path="settings" element={<div>Settings Page (Coming Soon)</div>} />
          <Route path="help" element={<div>Help Page (Coming Soon)</div>} />
        </Route>
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
