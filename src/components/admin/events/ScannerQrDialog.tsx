// EVENT-SYSTEEM FASE 4c — QR-weergave van een deur-toegang.
//
// De QR bevat de volledige scanner-URL (${origin}/scan/<token>) zodat een
// vrijwilliger hem met de camera kan openen zodra fase 5 die route bedient.
// Het token is uitsluitend leesbaar voor tenant_admin/staff van deze tenant (RLS).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { scannerUrl, type ScannerAccessRow } from '@/hooks/useEventScannerAccess';

interface Props {
  access: ScannerAccessRow | null;
  onOpenChange: (open: boolean) => void;
  zoneName: string;
  scopeLabel: string;
}

export function ScannerQrDialog({ access, onOpenChange, zoneName, scopeLabel }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const url = access ? scannerUrl(access.access_token) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={!!access} onOpenChange={(o) => { if (!o) { setCopied(false); onOpenChange(false); } }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('events.access.qr.title')}</DialogTitle>
          <DialogDescription>{t('events.access.qr.description')}</DialogDescription>
        </DialogHeader>

        {access && (
          <div className="space-y-3">
            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCode value={url} size={200} />
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium break-words">{access.name}</p>
              <p className="text-xs text-muted-foreground break-words">
                {zoneName} · {t(`events.access.direction.${access.direction}`)} ·{' '}
                {t(`events.access.scanMode.${access.scan_mode}`)}
              </p>
              <p className="text-xs text-muted-foreground break-words">{scopeLabel}</p>
            </div>
            <p className="text-xs text-muted-foreground break-all rounded-md border bg-muted/40 p-2">
              {url}
            </p>
            <p className="text-xs text-muted-foreground">{t('events.access.qr.secretHint')}</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('events.access.form.close')}
          </Button>
          <Button type="button" onClick={copy}>
            {copied
              ? <><Check className="mr-2 h-4 w-4" /> {t('events.access.qr.copied')}</>
              : <><Copy className="mr-2 h-4 w-4" /> {t('events.access.qr.copy')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
