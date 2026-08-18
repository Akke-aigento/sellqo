import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SessionExpiredDialogProps {
  open: boolean;
  onRelogin: () => void;
}

export function SessionExpiredDialog({ open, onRelogin }: SessionExpiredDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">{t('auth.sessionExpired.title')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('auth.sessionExpired.body')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onRelogin} className="w-full sm:w-auto">
            {t('auth.sessionExpired.action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
