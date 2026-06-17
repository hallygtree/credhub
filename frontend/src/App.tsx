import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage';
import { AdminOverview } from '@/pages/admin/AdminOverview';
import { SubscribersPage } from '@/pages/admin/SubscribersPage';
import { CompanyDetailPage } from '@/pages/admin/CompanyDetailPage';
import { CpfUserDetailPage } from '@/pages/admin/CpfUserDetailPage';
import { CompanyOverview } from '@/pages/company/CompanyOverview';
import { EmployeesPage } from '@/pages/company/EmployeesPage';
import { EmployeeDetailPage } from '@/pages/company/EmployeeDetailPage';
import { UserDashboard } from '@/pages/user/UserDashboard';
import { PixPaymentPage } from '@/pages/user/PixPaymentPage';
import { UserRole } from '@/types';
import { getRoleDefaultRoute } from '@/lib/utils';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RedirectBasedOnRole() {
  const { user, isLoading, mustChangePassword } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Force password change if required
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Navigate to={getRoleDefaultRoute(user.role)} replace />;
}

// Wrapper to check mustChangePassword before accessing protected routes
function RequirePasswordChanged({ children }: { children: React.ReactNode }) {
  const { mustChangePassword, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'white',
                border: '1px solid #E8E0D3',
                color: '#3D5A4C',
              },
            }}
          />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Change password - requires auth but allows mustChangePassword=true */}
            <Route path="/change-password" element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            } />

            {/* Protected app routes - require password changed */}
            <Route path="/app" element={
              <ProtectedRoute>
                <RequirePasswordChanged>
                  <AppLayout />
                </RequirePasswordChanged>
              </ProtectedRoute>
            }>
              {/* Admin Routes */}
              <Route path="admin/overview" element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <AdminOverview />
                </ProtectedRoute>
              } />
              <Route path="admin/subscribers" element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <SubscribersPage />
                </ProtectedRoute>
              } />
              <Route path="admin/subscribers/:id" element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <CompanyDetailPage />
                </ProtectedRoute>
              } />
              <Route path="admin/cpf-users/:id" element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <CpfUserDetailPage />
                </ProtectedRoute>
              } />

              {/* Company Viewer Routes */}
              <Route path="company/overview" element={
                <ProtectedRoute allowedRoles={[UserRole.COMPANY_VIEWER]}>
                  <CompanyOverview />
                </ProtectedRoute>
              } />
              <Route path="company/employees" element={
                <ProtectedRoute allowedRoles={[UserRole.COMPANY_VIEWER]}>
                  <EmployeesPage />
                </ProtectedRoute>
              } />
              <Route path="company/employees/:id" element={
                <ProtectedRoute allowedRoles={[UserRole.COMPANY_VIEWER]}>
                  <EmployeeDetailPage />
                </ProtectedRoute>
              } />

              {/* User Routes (Employee + CPF User) */}
              <Route path="user/dashboard" element={
                <ProtectedRoute allowedRoles={[UserRole.EMPLOYEE, UserRole.CPF_USER]}>
                  <UserDashboard />
                </ProtectedRoute>
              } />

              {/* Pix Payment (CPF_USER only — employees are recharged by company manager) */}
              <Route path="payments" element={
                <ProtectedRoute allowedRoles={[UserRole.CPF_USER]}>
                  <PixPaymentPage />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="/" element={<RedirectBasedOnRole />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
