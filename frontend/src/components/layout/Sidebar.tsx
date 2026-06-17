import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Menu,
  X,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoFull } from '@/components/ui/logo';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNavItems: NavItem[] = [
  { title: 'Painel', href: '/app/admin/overview', icon: LayoutDashboard },
  { title: 'Inscritos', href: '/app/admin/subscribers', icon: Users },
];

const companyNavItems: NavItem[] = [
  { title: 'Painel', href: '/app/company/overview', icon: LayoutDashboard },
  { title: 'Colaboradores', href: '/app/company/employees', icon: Users },
];

const employeeNavItems: NavItem[] = [
  { title: 'Meu Painel', href: '/app/user/dashboard', icon: LayoutDashboard },
];

const cpfUserNavItems: NavItem[] = [
  { title: 'Meu Painel', href: '/app/user/dashboard', icon: LayoutDashboard },
  { title: 'Pagar com Pix', href: '/app/payments', icon: QrCode },
];

interface SidebarContentProps {
  navItems: NavItem[];
  location: ReturnType<typeof useLocation>;
  user: { name?: string; email?: string } | null;
  roleLabel: string;
  logout: () => void;
  onNavClick?: () => void;
}

function SidebarContent({ navItems, location, user, roleLabel, logout, onNavClick }: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-brand-green px-6">
        <LogoFull variant="inverse" size="md" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/app/admin/overview' &&
             item.href !== '/app/company/overview' &&
             item.href !== '/app/employee/dashboard' &&
             location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand-cream text-brand-green-dark shadow-brand-sm'
                  : 'text-brand-cream/80 hover:bg-brand-green hover:text-brand-cream'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-brand-green p-4">
        <div className="mb-4 px-4 py-3 rounded-lg bg-brand-green">
          <p className="text-sm font-medium text-brand-cream truncate">{user?.name}</p>
          <p className="text-xs text-brand-cream/60 truncate">{user?.email}</p>
          <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-terracotta text-white">
            {roleLabel}
          </span>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-brand-cream/80 hover:text-brand-cream hover:bg-brand-green"
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          Encerrar sessão
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  const { user, logout, isSuperAdmin, isEmployee, isCpfUser } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = isSuperAdmin
    ? adminNavItems
    : isCpfUser
      ? cpfUserNavItems
      : isEmployee
        ? employeeNavItems
        : companyNavItems;

  const roleLabel = isSuperAdmin
    ? 'Administrador'
    : (isEmployee || isCpfUser)
      ? 'Usuario'
      : 'Gestor';

  const contentProps: SidebarContentProps = {
    navItems,
    location,
    user,
    roleLabel,
    logout,
    onNavClick: () => setMobileMenuOpen(false),
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-brand-green-dark text-brand-cream shadow-brand-md"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-brand-green-dark/60 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-40 w-72 flex flex-col bg-brand-green-dark transform transition-transform duration-300 ease-in-out",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent {...contentProps} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex sticky top-0 h-screen w-72 flex-col bg-brand-green-dark">
        <SidebarContent {...contentProps} onNavClick={undefined} />
      </div>
    </>
  );
}
