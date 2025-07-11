import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';

import { store } from '@/store';
import { theme } from '@/theme';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Dashboard } from '@/pages/Dashboard';
import { Projects } from '@/pages/Projects';
import { ProjectDetails } from '@/pages/ProjectDetails';
import { ThreatModels } from '@/pages/ThreatModels';
import { CreateThreatModel } from '@/pages/CreateThreatModel';
import { ThreatModelEditorPage } from '@/pages/ThreatModelEditor';
import { RiskAssessment } from '@/pages/RiskAssessment';
import { Vulnerabilities } from '@/pages/Vulnerabilities';
import { Threats } from '@/pages/Threats';
import { Reports } from '@/pages/Reports';
import { ProjectEdit } from '@/pages/ProjectEdit';
import { Login } from '@/pages/Login';
import { TMACPage } from '@/pages/TMAC';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App(): JSX.Element {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
            <Router
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/projects/:id" element={<ProjectDetails />} />
                        <Route path="/projects/:id/edit" element={<ProjectEdit />} />
                        <Route path="/projects/:projectId/threat-models/new" element={<CreateThreatModel />} />
                        <Route path="/threat-models" element={<ThreatModels />} />
                        <Route path="/threat-models/:id" element={<ThreatModelEditorPage />} />
                        <Route path="/threat-models/:id/edit" element={<ThreatModelEditorPage />} />
                        <Route path="/risk-assessment" element={<RiskAssessment />} />
                        <Route path="/vulnerabilities" element={<Vulnerabilities />} />
                        <Route path="/threats" element={<Threats />} />
                        <Route path="/projects/:projectId/reports" element={<Reports />} />
                        <Route path="/tmac" element={<TMACPage />} />
                        <Route path="/tmac/:threatModelId" element={<TMACPage />} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
          </SnackbarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;