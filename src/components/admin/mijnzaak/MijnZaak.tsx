// HORECA-INSTELLINGEN-1 — "Mijn zaak": Instellingen voor een horecazaak zonder webshop of events.
//
// Bovenaan de zoekbalk, dan (op het overzicht) de checklist "Je zaak inrichten" en de zes groepen.
// Elke groep heeft tabs bovenaan, deeplinkbaar: /admin/settings?section=<groep>&tab=<tab>.
// Oude links (?section=company, payments, team, …) gaan door naar hun nieuwe plek (legacySettingsTarget).
// Op de gsm: overzicht → groep, met een terugknop; op desktop een vaste lijst links.
import { useEffect } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, Building2, ChevronLeft, ChevronRight, CreditCard, LayoutDashboard, Monitor, User, UtensilsCrossed, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHorecaStatus } from '@/hooks/useHorecaStatus';
import { useZaakAccess } from '@/hooks/useZaakAccess';
import { useScopedRoles } from '@/hooks/useCan';
import { useEmailLogoAutoBackfill } from '@/hooks/useEmailLogoBackfill';
import { SETTINGS_PATH, ZAAK_GROUPS, findGroup, legacySettingsTarget, mijnZaakUrl, type ZaakGroup } from '@/lib/mijnZaak';
import { MoreToolsSettings } from '@/components/admin/settings/MoreToolsSettings';
import { SetupChecklist } from './SetupChecklist';
import { SettingsSearch } from './SettingsSearch';
import { GksNotice } from './GksNotice';
import { ZaakTabContent } from './MijnZaakTabs';

const GROUP_ICONS: Record<string, LucideIcon> = {
  zaak: Building2, gasten: Users, betalen: CreditCard, 'zaal-keuken': UtensilsCrossed, toestellen: Monitor, geld: Banknote, jij: User,
};

export function MijnZaak() {
  const { t } = useTranslation();
  // MAIL-UX-1: zoals Instellingen — ontbrekende mailversie van het logo stil aanmaken (best effort).
  useEmailLogoAutoBackfill();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const isMobile = useIsMobile();
  const canOpen = useZaakAccess();
  const rolesKnown = useScopedRoles() !== null;
  const status = useHorecaStatus();

  const section = params.get('section');
  const tabParam = params.get('tab');
  const visibleTabs = (g: ZaakGroup) => g.tabs.filter((tb) => canOpen(tb));
  const groups = ZAAK_GROUPS.filter((g) => visibleTabs(g).length > 0);
  const group = groups.find((g) => g.id === section);
  const tabs = group ? visibleTabs(group) : [];
  const tab = tabs.find((tb) => tb.id === tabParam) ?? tabs[0];

  // Na een klik in het menu bovenaan beginnen (de inhoud staat soms ver naar onder).
  useEffect(() => {
    const main = (document.querySelector('main.overflow-y-auto') as HTMLElement | null) || document.querySelector('main');
    main?.scrollTo?.({ top: 0, behavior: 'auto' });
  }, [section]);

  // Oude ?section= (Bedrijfsgegevens, Betalingen, Teamleden, Horeca, …) → nieuwe plek.
  if (section && !findGroup(section)) {
    const to = legacySettingsTarget(section, location.hash);
    if (to) return <Navigate to={to} replace />;
  }

  // 1b: de beschrijving volgt de tabs die deze rol ziet. Ziet hij ze allemaal, dan de uitgeschreven zin;
  // anders de labels van wat hij wél ziet (zo belooft een kaart nooit iets dat er niet achter staat).
  const descFor = (g: ZaakGroup) => {
    const seen = visibleTabs(g);
    return seen.length === g.tabs.length ? t(g.descKey) : seen.map((tb) => t(tb.labelKey)).join(' · ');
  };
  // Een groep met één zichtbare tab linkt meteen naar die tab.
  const groupUrl = (g: ZaakGroup) => {
    const seen = visibleTabs(g);
    return seen.length === 1 ? mijnZaakUrl(g.id, seen[0].id) : mijnZaakUrl(g.id);
  };

  const setTab = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', id); return n; }, { replace: true });
  const showOverview = !group;
  // 1b: "Mijn zaak blijft voor de beheerder": de checklist en de groepen van de zaak enkel voor
  // tenant_admin/platform_admin (zoals de RLS). Iedereen ziet wat hij mag, plus één regel uitleg.
  const isOwner = canOpen({ adminOnly: true });

  const nav = (
    <nav aria-label={t('mijnZaak.title')} className="space-y-1">
      <NavButton to={SETTINGS_PATH} active={showOverview} icon={LayoutDashboard} label={t('mijnZaak.overview')} />
      {groups.filter((g) => g.id !== 'jij').map((g) => (
        <NavButton key={g.id} to={groupUrl(g)} active={group?.id === g.id} icon={GROUP_ICONS[g.id]} label={t(g.titleKey)} />
      ))}
      {groups.some((g) => g.id === 'jij') ? (
        <div className="mt-3 border-t pt-3">
          <NavButton to={mijnZaakUrl('jij')} active={group?.id === 'jij'} icon={User} label={t('mijnZaak.groups.jij.title')} />
        </div>
      ) : null}
    </nav>
  );

  return (
    <div className="space-y-6">
      {isMobile && group ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to={SETTINGS_PATH}><ChevronLeft className="mr-1 h-4 w-4" />{t('mijnZaak.title')}</Link>
          </Button>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('mijnZaak.title')}</h1>
          <p className="text-muted-foreground">{t('mijnZaak.subtitle')}</p>
        </div>
      )}

      <div className="relative z-20 max-w-2xl">
        <SettingsSearch inline />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {!isMobile ? (
          <aside className="lg:w-60 lg:flex-shrink-0">
            <Card><CardContent className="p-2">{nav}</CardContent></Card>
          </aside>
        ) : null}

        <div className="min-w-0 flex-1 space-y-6">
          {showOverview ? (
            <>
              {isOwner ? <SetupChecklist status={status.data} isLoading={status.isLoading} /> : rolesKnown ? (
                <p data-testid="owner-note" className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{t('mijnZaak.owner_note')}</p>
              ) : null}
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('mijnZaak.groups_heading')}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {groups.map((g) => {
                    const Icon = GROUP_ICONS[g.id];
                    return (
                      <li key={g.id}>
                        <Link to={groupUrl(g)} className="flex h-full min-h-[72px] items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted/50 hover:no-underline">
                          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{t(g.titleKey)}</span>
                            <span className="block text-sm text-muted-foreground">{descFor(g)}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {isOwner ? <GksNotice /> : null}
              {/* 1b: het SellQo-plan staat al onder Geld › SellQo-plan; niet nog eens onderaan. */}
              <div id="meer"><MoreToolsSettings exclude={['billing']} /></div>
            </>
          ) : (
            <section className="space-y-4" aria-labelledby="mijnzaak-group-title">
              <div>
                <h2 id="mijnzaak-group-title" className="text-2xl font-semibold">{t(group.titleKey)}</h2>
                <p className="text-sm text-muted-foreground">{descFor(group)}</p>
              </div>
              <div role="tablist" aria-label={t(group.titleKey)} className="flex gap-1 overflow-x-auto border-b">
                {tabs.map((tb) => (
                  <button key={tb.id} type="button" role="tab" aria-selected={tab?.id === tb.id} onClick={() => setTab(tb.id)}
                    className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab?.id === tb.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    {t(tb.labelKey)}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="max-w-5xl">
                {tab ? <ZaakTabContent group={group.id} tab={tab.id} /> : null}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({ to, active, icon: Icon, label }: { to: string; active: boolean; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} aria-current={active ? 'page' : undefined}
      className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:no-underline', active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted')}>
      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span className="flex-1 text-left">{label}</span>
      {active ? <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden /> : null}
    </Link>
  );
}
