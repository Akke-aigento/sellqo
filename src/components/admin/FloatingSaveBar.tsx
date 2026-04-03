import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingSaveBarProps {
  isDirty: boolean;
  isSaving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
}

export function FloatingSaveBar({ 
  isDirty, 
  isSaving = false, 
  onSave, 
  onCancel, 
  saveLabel = 'Opslaan',
  cancelLabel = 'Annuleren',
}: FloatingSaveBarProps) {
  if (!isDirty) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-40 bg-background border-t shadow-lg",
      "lg:left-[var(--sidebar-width,280px)]",
      "animate-in slide-in-from-bottom-4 duration-200"
    )}>
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-muted-foreground">Onopgeslagen wijzigingen</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" />
            {cancelLabel}
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? 'Opslaan...' : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
