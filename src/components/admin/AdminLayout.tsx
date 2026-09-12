import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
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
import { SandboxBanner } from '@/components/SandboxBanner';
import { PushPermissionBanner } from '@/components/PushPermissionBanner';
import { useTenant } from '@/hooks/useTenant';

function AdminLayoutContent() {
  // Global notification listener for sounds + toasts on ALL admin pages
  useGlobalNotificationListener();
  const location = useLocation();
  const isDashboard = location.pathname === '/admin' || location.pathname === '/admin/dashboard';
  const { currentTenant } = useTenant();
  const { setOpenMobile } = useSidebar();
  const mainRef = useRef<HTMLElement>(null);

  // Auto-close mobile sidebar on navigation. Always call setOpenMobile(false)
  // because it only affects the mobile Sheet state; desktop is unaffected.
  //
  // Hier wordt ook <main> teruggescrold. ScrollToTop doet window.scrollTo(0, 0),
  // en dat raakt niets meer sinds de admin-shell een vaste hoogte heeft: het
  // document scrolt niet, <main> wel. Zonder deze regel houd je de scrollpositie
  // van de vorige pagina vast.
  useEffect(() => {
    setOpenMobile(false);
    mainRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      {/* h-dvh en niet min-h-dvh: een minimumhoogte begrenst de flex-keten niet,
          waardoor <main> nooit een definiete hoogte kreeg en overflow-y-auto dus
          nooit aansloeg. Het document scrolde dan in plaats van <main>, en de
          sticky header schoof gewoon mee weg — op desktop net zo goed als op
          mobiel. De min-h-0's hieronder horen erbij: een flex-child heeft
          standaard min-height:auto en kan anders niet onder zijn inhoud krimpen. */}
      <div className="h-dvh flex w-full min-w-0 overflow-hidden">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <AdminHeader />
          {/* Sandbox banner - only for demo tenants */}
          <SandboxBanner isDemo={currentTenant?.is_demo === true} />
          {/* Native-only: recovery path when OS notification permission was denied */}
          <PushPermissionBanner />
          {/* Trial Banner - shows remaining trial days */}
          <TrialBanner />
          <main ref={mainRef} className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden pb-[var(--admin-nav-offset)] md:pb-6">
            <div className="p-4 lg:p-6 max-w-screen-2xl mx-auto w-full min-w-0">
              <Outlet />
            </div>
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
