// HORECA-INSTELLINGEN-1 — wat elke tab van Mijn zaak toont. Uitsluitend bestaande componenten op hun
// nieuwe plek; geen nieuwe bewerkplekken. Waar iets niet los te trekken is zonder logica te wijzigen,
// toont de tab de stand met een link naar de ene plek waar je het wijzigt (zie Fooi, Zaalplan).
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChefHat, ChevronRight, ExternalLink, Globe, LayoutGrid, Link2, Monitor, Plus, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenant';
import { useHorecaStatus } from '@/hooks/useHorecaStatus';
import { useZaakAccess } from '@/hooks/useZaakAccess';
import { FLOOR_EDIT_PATH, mijnZaakUrl } from '@/lib/mijnZaak';
import { BusinessSettings } from '@/components/admin/settings/BusinessSettings';
import { BusinessHoursCard } from '@/components/admin/settings/hours/BusinessHoursCard';
import { BrandingSettings } from '@/components/admin/settings/BrandingSettings';
import { QrModeSettings } from '@/components/admin/storefront/food/QrModeSettings';
import { MenuQrManager } from '@/components/admin/storefront/food/MenuQrManager';
import { FulfillmentSettings } from '@/components/admin/storefront/food/FulfillmentSettings';
import { ReservationsManager } from '@/components/admin/horeca/ReservationsManager';
import { CustomerCommunicationSettings } from '@/components/admin/settings/CustomerCommunicationSettings';
import { HorecaPaySettings } from '@/components/admin/pos/HorecaPaySettings';
import { PaymentSettings } from '@/components/admin/settings/PaymentSettings';
import { TransactionFeeSettings } from '@/components/admin/settings/TransactionFeeSettings';
import { PrepStationsManager } from '@/components/admin/horeca/PrepStationsManager';
import { CoursesSettings } from '@/components/admin/horeca/CoursesSettings';
import { HorecaPrinters } from '@/components/admin/pos/HorecaPrinters';
import { PosTerminalsPanel } from '@/components/admin/pos/PosTerminalsPanel';
import { HorecaLockSetting } from '@/components/admin/pos/HorecaLockSetting';
import { HorecaNotifyDevices } from '@/components/admin/horeca/HorecaNotifyDevices';
import { NotificationSettings } from '@/components/admin/settings/NotificationSettings';
import { TaxSettings } from '@/components/admin/settings/TaxSettings';
import { VatRatesSettings } from '@/components/admin/settings/VatRatesSettings';
import { InvoiceAutomationSettings } from '@/components/admin/settings/InvoiceAutomationSettings';
import { PeppolSettings } from '@/components/admin/settings/PeppolSettings';
import { InvoiceComplianceCard } from '@/components/admin/settings/InvoiceComplianceCard';
import { AccountingSettings } from '@/components/admin/settings/AccountingSettings';
import { BusinessModulesSettings } from '@/components/admin/settings/BusinessModulesSettings';
import { AccountSettings } from '@/components/admin/settings/AccountSettings';
import { MyNotificationSettings } from '@/components/admin/settings/MyNotificationSettings';
import { MyBottomNavSettings } from '@/components/admin/settings/MyBottomNavSettings';

/** Een kaart met uitleg en één of meer knoppen naar de plek waar het gebeurt. */
function LinkCard({ icon, title, desc, status, actions }: { icon: ReactNode; title: string; desc: string; status?: ReactNode; actions: { to: string; label: string; external?: boolean; primary?: boolean }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status ? <div className="text-sm">{status}</div> : null}
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.to} asChild size="sm" variant={a.primary ? 'default' : 'outline'}>
              {a.external
                ? <a href={a.to} target="_blank" rel="noreferrer">{a.label}<ExternalLink className="ml-1.5 h-4 w-4" aria-hidden /></a>
                : <Link to={a.to}>{a.label}<ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Link>}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WebsiteTab() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { data } = useHorecaStatus();
  const domain = `${currentTenant?.slug ?? ''}.sellqo.shop`;
  return (
    <div className="space-y-3">
    <LinkCard icon={<Globe className="h-5 w-5" aria-hidden />} title={t('mijnZaak.website.title')} desc={t('mijnZaak.website.desc')}
      status={<span className="flex flex-wrap items-center gap-2"><span className="font-medium">{domain}</span>
        {data ? <Badge variant={data.shopLive ? 'default' : 'secondary'}>{data.shopLive ? t('mijnZaak.website.live') : t('mijnZaak.website.offline')}</Badge> : null}</span>}
      actions={[{ to: '/admin/storefront', label: t('mijnZaak.website.open'), primary: true }, { to: `https://${domain}`, label: t('mijnZaak.website.view'), external: true }]} />
    {/* 1b: ?section=domain komt hier uit; een eigen domein op het SellQo-thema is nog niet bewezen (UREN-1c). */}
    <p className="flex items-center gap-2 text-sm text-muted-foreground"><Link2 className="h-4 w-4 shrink-0" aria-hidden />{t('mijnZaak.website.domain_soon')}</p>
    </div>
  );
}

function FloorTab() {
  const { t } = useTranslation();
  const { data } = useHorecaStatus();
  return (
    <LinkCard icon={<LayoutGrid className="h-5 w-5" aria-hidden />} title={t('mijnZaak.floor.title')} desc={t('mijnZaak.floor.desc')}
      status={data ? (data.tables > 0 ? t('admin.orderingHub.floor_summary', { tables: data.tables, areas: data.areas }) : t('admin.orderingHub.floor_none')) : null}
      actions={[{ to: FLOOR_EDIT_PATH, label: t('mijnZaak.floor.edit'), primary: true }, { to: '/admin/zaal', label: t('mijnZaak.floor.live') }]} />
  );
}

function KitchenScreensTab() {
  const { t } = useTranslation();
  return (
    <LinkCard icon={<ChefHat className="h-5 w-5" aria-hidden />} title={t('mijnZaak.kitchen.title')} desc={t('mijnZaak.kitchen.desc')}
      actions={[{ to: '/admin/keuken', label: t('mijnZaak.kitchen.open'), primary: true }, { to: mijnZaakUrl('zaal-keuken', 'posten'), label: t('mijnZaak.kitchen.stations') }]} />
  );
}

function PlanTab() {
  const { t } = useTranslation();
  const canOpen = useZaakAccess();
  return (
    <div className="space-y-4">
      <LinkCard icon={<Receipt className="h-5 w-5" aria-hidden />} title={t('mijnZaak.plan.title')} desc={t('mijnZaak.plan.desc')}
        actions={[{ to: '/admin/billing', label: t('mijnZaak.plan.open'), primary: true }]} />
      {/* Modules was "enkel zaakvoerder" op Instellingen; dat blijft zo. */}
      {canOpen({ adminOnly: true }) ? <BusinessModulesSettings /> : null}
    </div>
  );
}

/** Fooi: kassafooi (echte schakelaar, Kassa-instellingen) + de stand van online fooi met een link naar QR aan tafel. */
function TipTab() {
  const { t } = useTranslation();
  const { data } = useHorecaStatus();
  // Online fooi werkt enkel bij QR-bestellen op de tafelrekening met online afrekenen (QrModeSettings).
  const onlineTip = !!data && data.qrMode === 'order' && data.qrFlow === 'check' && data.checkOnline && data.onlineTip;
  return (
    <div className="space-y-4">
      <HorecaPaySettings parts={['tip']} />
      <LinkCard icon={<Receipt className="h-5 w-5" aria-hidden />} title={t('mijnZaak.tip.online_title')} desc={t('mijnZaak.tip.online_desc')}
        status={data ? <span>{t('mijnZaak.tip.online_now')} <Badge variant={onlineTip ? 'default' : 'secondary'}>{onlineTip ? t('settings.horecaHub.on') : t('settings.horecaHub.off')}</Badge></span> : null}
        actions={[{ to: mijnZaakUrl('gasten', 'qr'), label: t('mijnZaak.tip.online_link'), primary: true }]} />
    </div>
  );
}

function TerminalsTab() {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />{t('admin.pOS.nieuwe_terminal')}</Button>
        <Button variant="outline" asChild><Link to="/kassa"><Monitor className="mr-2 h-4 w-4" />{t('admin.pOS.openKassaApp')}</Link></Button>
      </div>
      <PosTerminalsPanel createOpen={createOpen} onCreateOpenChange={setCreateOpen} showNotify={false} />
    </div>
  );
}

function QrTab() {
  const navigate = useNavigate();
  return <div className="space-y-6"><QrModeSettings /><MenuQrManager onOpenFloorPlan={() => navigate(FLOOR_EDIT_PATH)} /></div>;
}

function NotifyTab() {
  const canOpen = useZaakAccess();
  return (
    <div className="space-y-6">
      <HorecaNotifyDevices />
      {/* Winkelmeldingen stonden op Instellingen (settings_general). */}
      {canOpen({ requiredRead: 'settings_general' }) ? <NotificationSettings /> : null}
    </div>
  );
}

function InvoicesTab() {
  const canOpen = useZaakAccess();
  return (
    <div className="space-y-6">
      <InvoiceAutomationSettings />
      {/* Peppol volgde op Instellingen de plan-feature 'peppol'; dat blijft zo. */}
      {canOpen({ featureKey: 'peppol' }) ? <PeppolSettings /> : null}
      <InvoiceComplianceCard />
    </div>
  );
}

/** De inhoud van één tab. Onbekende combinatie: niets (Mijn zaak valt dan terug op de eerste tab). */
export function ZaakTabContent({ group, tab }: { group: string; tab: string }) {
  switch (`${group}/${tab}`) {
    case 'zaak/gegevens': return <BusinessSettings showHours={false} />;
    case 'zaak/uren': return <BusinessHoursCard />;
    case 'zaak/merk': return <BrandingSettings />;
    case 'zaak/website': return <WebsiteTab />;
    case 'gasten/qr': return <QrTab />;
    case 'gasten/afhalen': return <FulfillmentSettings />;
    case 'gasten/reserveren': return <ReservationsManager part="settings" />;
    case 'gasten/berichten': return <CustomerCommunicationSettings />;
    case 'betalen/kassa': return <HorecaPaySettings parts={['methods']} />;
    case 'betalen/online': return <div className="space-y-6"><HorecaPaySettings parts={['qr']} /><PaymentSettings /><TransactionFeeSettings /></div>;
    case 'betalen/fooi': return <TipTab />;
    case 'betalen/terminal': return <HorecaPaySettings parts={['terminal']} />;
    case 'zaal-keuken/zaalplan': return <FloorTab />;
    case 'zaal-keuken/posten': return <div className="space-y-6"><PrepStationsManager /><div className="max-w-3xl"><CoursesSettings /></div></div>;
    case 'zaal-keuken/printers': return <HorecaPrinters />;
    case 'zaal-keuken/keukenschermen': return <KitchenScreensTab />;
    case 'toestellen/kassas': return <TerminalsTab />;
    case 'toestellen/vergrendeling': return <HorecaLockSetting />;
    case 'toestellen/meldingen': return <NotifyTab />;
    case 'geld/btw': return <div className="space-y-6"><TaxSettings /><VatRatesSettings /></div>;
    case 'geld/facturen': return <InvoicesTab />;
    case 'geld/boekhouding': return <AccountingSettings />;
    case 'geld/plan': return <PlanTab />;
    case 'jij/profiel': return <AccountSettings />;
    case 'jij/mijn-meldingen': return <MyNotificationSettings />;
    case 'jij/onderbalk': return <MyBottomNavSettings />;
    default: return null;
  }
}
