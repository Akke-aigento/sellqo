// HORECA-ZIJBALK-1 (ronde 3) — Instellingen › Boekhouding, enkel voor horeca zonder webshop/events
// (zie src/lib/accountingLink.ts). Zelfde kaart en instellingen als SellQo Connect › Boekhouding:
// OdooAccountingCard bewaakt het plan (checkFeature('odoo_sync')) en toont anders de upgrade.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OdooAccountingCard } from '@/components/admin/accounting/OdooAccountingCard';
import { OdooAccountingSettings } from '@/components/admin/accounting/OdooAccountingSettings';
import { useTenant } from '@/hooks/useTenant';

export function AccountingSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.accounting.title')}</CardTitle>
        <CardDescription>{t('settings.accounting.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="max-w-xl">
        <OdooAccountingCard tenantId={currentTenant?.id} onOpen={() => setOpen(true)} />
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('settings.accounting.dialog_title')}</DialogTitle>
            <DialogDescription>{t('settings.accounting.dialog_desc')}</DialogDescription>
          </DialogHeader>
          {currentTenant ? <OdooAccountingSettings tenantId={currentTenant.id} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
