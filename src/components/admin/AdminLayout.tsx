import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { TenantProvider } from '@/hooks/useTenant';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { GamificationProvider } from '@/components/gamification';
import { TrialBanner } from './TrialBanner';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { useGlobalNotificationListener } from '@/hooks/useGlobalNotificationListener';

function AdminLayoutContent() {
  // Global notification listener for sounds + toasts on ALL admin pages
  useGlobalNotificationListener();

  return (
    <>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AdminHeader />
          {/* Trial Banner - shows remaining trial days */}
          <TrialBanner />
          <main className="flex-1 p-4 lg:p-6 min-w-0 overflow-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
      {/* Onboarding wizard for new users */}
      <OnboardingWizard />
      {/* Trial expired blocker - blocks access when trial ends */}
      <TrialExpiredBlocker />
    </>
  );
}

export function AdminLayout() {
  return (
    <TenantProvider>
      <GamificationProvider>
        <SidebarProvider>
          <AdminLayoutContent />
        </SidebarProvider>
      </GamificationProvider>
    </TenantProvider>
  );
}
