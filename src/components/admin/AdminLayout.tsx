import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { TenantProvider } from '@/hooks/useTenant';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { GamificationProvider } from '@/components/gamification';
import { TrialBanner } from './TrialBanner';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';

export function AdminLayout() {
  return (
    <TenantProvider>
      <GamificationProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AdminSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              <AdminHeader />
              {/* Trial Banner - shows remaining trial days */}
              <TrialBanner />
              <main className="flex-1 p-4 lg:p-6">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
          {/* Onboarding wizard for new users */}
          <OnboardingWizard />
          {/* Trial expired blocker - blocks access when trial ends */}
          <TrialExpiredBlocker />
        </SidebarProvider>
      </GamificationProvider>
    </TenantProvider>
  );
}
