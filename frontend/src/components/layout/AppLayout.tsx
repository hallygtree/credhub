import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-brand-cream">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden lg:ml-0">
        {/* Mobile top padding for menu button */}
        <div className="lg:hidden h-16" />

        {/* Main content area */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
