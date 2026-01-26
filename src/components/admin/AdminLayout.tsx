import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { TenantProvider } from '@/hooks/useTenant';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export function AdminLayout() {
  return (
    <TenantProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <SidebarInset className="flex-1">
            <AdminHeader />
            <main className="flex-1 p-4 lg:p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
        {/* Onboarding wizard for new users */}
        <OnboardingWizard />
      </SidebarProvider>
    </TenantProvider>
  );
}
