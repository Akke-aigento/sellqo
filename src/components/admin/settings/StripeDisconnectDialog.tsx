import { useState, useEffect } from 'react';
import { Loader2, Unlink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface StripeDisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantName: string;
  stripeAccountId: string;
  isDisconnecting: boolean;
  /** Called with the confirmed tenant name once the admin has typed it correctly. */
  onConfirm: (confirmedTenantName: string) => void | Promise<void>;
  trigger?: React.ReactNode;
}

/**
 * Type-to-confirm dialog for the destructive Stripe disconnect flow.
 * Pattern mirrors GitHub repo deletion: the admin must type the exact tenant
 * name before the destructive action becomes available.
 */
export function StripeDisconnectDialog({
  open,
  onOpenChange,
  tenantName,
  stripeAccountId,
  isDisconnecting,
  onConfirm,
  trigger,
}: StripeDisconnectDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const matches = typed.trim() === (tenantName ?? '').trim() && tenantName.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Stripe account ontkoppelen?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Je staat op het punt het Stripe connected account permanent te
                verwijderen voor:
              </p>
              <div className="rounded-md border bg-muted/50 p-3 space-y-1">
                <div>
                  <span className="text-muted-foreground">Tenant:</span>{' '}
                  <strong>{tenantName || '—'}</strong>
                </div>
                <div className="break-all">
                  <span className="text-muted-foreground">Stripe account:</span>{' '}
                  <code className="font-mono text-xs">{stripeAccountId || '—'}</code>
                </div>
              </div>
              <p className="text-destructive font-medium">
                Dit is destructief en kan niet ongedaan gemaakt worden bij
                Express-accounts.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-tenant-name" className="text-sm">
            Typ <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{tenantName}</code>{' '}
            om te bevestigen:
          </Label>
          <Input
            id="confirm-tenant-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={tenantName}
            autoComplete="off"
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDisconnecting}
          >
            Annuleren
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || isDisconnecting}
            onClick={() => onConfirm(typed.trim())}
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4 mr-2" />
            )}
            Definitief ontkoppelen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
