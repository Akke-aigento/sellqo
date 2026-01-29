import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface SlugConflictDialogProps {
  open: boolean;
  originalSlug: string;
  suggestedSlug: string;
  onAccept: (newSlug: string) => void;
  onGoToStep1: () => void;
}

export function SlugConflictDialog({
  open,
  originalSlug,
  suggestedSlug,
  onAccept,
  onGoToStep1,
}: SlugConflictDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <AlertDialogTitle className="text-left">
              URL niet meer beschikbaar
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              De URL <strong className="text-foreground">sellqo.app/shop/{originalSlug}</strong> is 
              helaas al in gebruik door een andere winkel.
            </p>
            <p>
              We stellen voor om de volgende URL te gebruiken:
            </p>
            <div className="bg-muted p-3 rounded-md font-mono text-sm">
              sellqo.app/shop/<strong className="text-primary">{suggestedSlug}</strong>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onGoToStep1} className="w-full sm:w-auto">
            Zelf kiezen
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => onAccept(suggestedSlug)}
            className="w-full sm:w-auto"
          >
            Accepteer "{suggestedSlug}"
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
