import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { UserRole } from '@/types';

// Mock react-router-dom so we don't need a heavy router context
vi.mock('react-router-dom', () => ({
  Navigate: vi.fn(({ to }: { to: string }) => (
    <div data-testid="navigate-redirect" data-to={to} />
  )),
  useLocation: vi.fn(() => ({
    pathname: '/test',
    state: null,
    key: 'default',
    search: '',
    hash: '',
  })),
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProtectedRoute', () => {
  it('should show a loading spinner while authentication is loading', () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
    } as any);

    render(
      <ProtectedRoute>
        <div>Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should redirect to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
    } as any);

    render(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute('data-to', '/login');
  });

  it('should render children when authenticated with no role restriction', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { role: UserRole.CPF_USER, mustChangePassword: false },
    } as any);

    render(
      <ProtectedRoute>
        <div>Dashboard</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render children when user role matches allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { role: UserRole.SUPER_ADMIN, mustChangePassword: false },
    } as any);

    render(
      <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
        <div>Admin Panel</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  it('should show "Acesso Negado" when user role is not in allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { role: UserRole.EMPLOYEE, mustChangePassword: false },
    } as any);

    render(
      <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
        <div>Admin Only</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
    expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
  });

  // Security: PIX route restriction (EMPLOYEE cannot access CPF_USER PIX route)
  it('should block EMPLOYEE from the CPF_USER-only PIX route', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { role: UserRole.EMPLOYEE, mustChangePassword: false },
    } as any);

    render(
      <ProtectedRoute allowedRoles={[UserRole.CPF_USER]}>
        <div>Pagar com Pix</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Pagar com Pix')).not.toBeInTheDocument();
    expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
  });

  it('should block COMPANY_VIEWER from user-only routes', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { role: UserRole.COMPANY_VIEWER, mustChangePassword: false },
    } as any);

    render(
      <ProtectedRoute allowedRoles={[UserRole.EMPLOYEE, UserRole.CPF_USER]}>
        <div>User Dashboard</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('User Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
  });

  it('should allow COMPANY_VIEWER to access company-scoped routes', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { role: UserRole.COMPANY_VIEWER, mustChangePassword: false },
    } as any);

    render(
      <ProtectedRoute allowedRoles={[UserRole.COMPANY_VIEWER]}>
        <div>Company Overview</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Company Overview')).toBeInTheDocument();
  });

  it('should render children when user has one of multiple allowed roles', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { role: UserRole.EMPLOYEE, mustChangePassword: false },
    } as any);

    render(
      <ProtectedRoute allowedRoles={[UserRole.EMPLOYEE, UserRole.CPF_USER]}>
        <div>My Dashboard</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('My Dashboard')).toBeInTheDocument();
  });
});
