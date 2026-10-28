// EVENT-SCAN-1 — elke eventpagina hoort achter de module Events, niet alleen het menu.
// Zonder module toont de route de vriendelijke "module staat uit"-kaart.
import type { ReactNode } from 'react';
import { useBusinessModules } from '@/hooks/useBusinessModules';
import { ModuleGateLoading, ModuleOffCard } from '@/components/admin/ModuleOffCard';

export function EventsModuleGate({ children }: { children: ReactNode }) {
  const { has, ready } = useBusinessModules();
  if (!ready) return <ModuleGateLoading />;
  if (!has('events')) return <ModuleOffCard module="events" />;
  return <>{children}</>;
}
