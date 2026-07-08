import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MandateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
}

export function MandateLinkDialog({
  open,
  onOpenChange,
  url,
  customerEmail,
  customerName,
}: MandateLinkDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    if (!url) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      try {
        const input = inputRef.current;
        if (input) {
          input.focus();
          input.select();
          ok = document.execCommand('copy');
        }
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpen = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleMail = () => {
    if (!url || !customerEmail) return;
    const subject = encodeURIComponent(t('subscriptions.mandate.dialog.mail_subject'));
    const greetingName = customerName?.trim() || '';
    const body = encodeURIComponent(
      t('subscriptions.mandate.dialog.mail_body', {
        name: greetingName,
        url,
      }),
    );
    window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('subscriptions.mandate.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('subscriptions.mandate.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            readOnly
            value={url ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            onClick={handleCopy}
            variant={copied ? 'secondary' : 'default'}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                {t('subscriptions.mandate.dialog.copied')}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                {t('subscriptions.mandate.dialog.copy')}
              </>
            )}
          </Button>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleOpen}>
              <ExternalLink className="h-4 w-4 mr-1" />
              {t('subscriptions.mandate.dialog.open')}
            </Button>
            {customerEmail && (
              <Button type="button" variant="outline" size="sm" onClick={handleMail}>
                <Mail className="h-4 w-4 mr-1" />
                {t('subscriptions.mandate.dialog.email')}
              </Button>
            )}
          </div>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('subscriptions.mandate.dialog.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}