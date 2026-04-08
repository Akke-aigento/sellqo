import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { TenantProvider } from '@/hooks/useTenant';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { GamificationProvider } from '@/components/gamification';
import { TrialBanner } from './TrialBanner';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { useGlobalNotificationListener } from '@/hooks/useGlobalNotificationListener';
import { AIHelpWidget } from '@/components/admin/help/AIHelpWidget';
import { PlatformViewModeProvider } from '@/hooks/usePlatformViewMode';
import { AdminMobileBottomNav } from './AdminMobileBottomNav';

function AdminLayoutContent() {
  // Global notification listener for sounds + toasts on ALL admin pages
  useGlobalNotificationListener();
  const location = useLocation();
  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/dashboard';

  return (
    <>
      <div className="min-h-screen flex w-full min-w-0 overflow-hidden">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AdminHeader />
          {/* Trial Banner - shows remaining trial days */}
          <TrialBanner />
          <main className="flex-1 p-4 lg:p-6 min-w-0 overflow-y-auto overflow-x-hidden pb-20 md:pb-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
      {/* Onboarding wizard for new users */}
      <OnboardingWizard />
      {/* Trial expired blocker - blocks access when trial ends */}
      <TrialExpiredBlocker />
      {/* AI Help Widget - floating chat assistant, only on dashboard */}
      {isDashboard && <AIHelpWidget />}
      {/* Mobile bottom navigation */}
      <AdminMobileBottomNav />
    </>
  );
}

export function AdminLayout() {
  return (
    <TenantProvider>
      <PlatformViewModeProvider>
        <GamificationProvider>
          <SidebarProvider>
            <AdminLayoutContent />
          </SidebarProvider>
        </GamificationProvider>
      </PlatformViewModeProvider>
    </TenantProvider>
  );
}
