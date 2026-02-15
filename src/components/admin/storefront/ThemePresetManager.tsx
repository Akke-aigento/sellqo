import { useState } from 'react';
import { Plus, X, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useThemePresets, type ThemePresetSettings } from '@/hooks/useThemePresets';

interface ThemePresetManagerProps {
  currentSettings: ThemePresetSettings;
  onLoadPreset: (settings: ThemePresetSettings) => void;
}

export function ThemePresetManager({ currentSettings, onLoadPreset }: ThemePresetManagerProps) {
  const { presets, isLoading, createPreset, deletePreset } = useThemePresets();
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [pendingPreset, setPendingPreset] = useState<{ name: string; settings: ThemePresetSettings } | null>(null);

  const handleSave = () => {
    if (!presetName.trim()) return;
    createPreset.mutate(
      { name: presetName.trim(), settings: currentSettings },
      { onSuccess: () => { setSaveOpen(false); setPresetName(''); } }
    );
  };

  const handleLoadConfirm = () => {
    if (pendingPreset) {
      onLoadPreset(pendingPreset.settings);
      setPendingPreset(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Bookmark className="h-3.5 w-3.5" />
        <span>Presets</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <div key={preset.id} className="group relative">
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted pr-6 flex items-center gap-1.5 h-8"
              onClick={() => setPendingPreset({ name: preset.name, settings: preset.settings as unknown as ThemePresetSettings })}
            >
              {/* Color dots */}
              <div className="flex -space-x-0.5">
                {[
                  (preset.settings as any)?.primary_color,
                  (preset.settings as any)?.secondary_color,
                  (preset.settings as any)?.accent_color,
                ].filter(Boolean).map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full border border-background"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-xs">{preset.name}</span>
            </Badge>
            <button
              onClick={(e) => { e.stopPropagation(); deletePreset.mutate(preset.id); }}
              className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Save as Preset button */}
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" />
              Opslaan als Preset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Preset opslaan</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input
                placeholder="Bijv. Kerst thema, Zomer stijl..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              {/* Preview of colors being saved */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Kleuren:</span>
                <div className="flex gap-1">
                  {[currentSettings.primary_color, currentSettings.secondary_color, currentSettings.accent_color].filter(Boolean).map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded border" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSaveOpen(false)}>Annuleren</Button>
              <Button size="sm" onClick={handleSave} disabled={!presetName.trim() || createPreset.isPending}>
                Opslaan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Load confirmation dialog */}
      <AlertDialog open={!!pendingPreset} onOpenChange={(open) => !open && setPendingPreset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preset laden: {pendingPreset?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Al je huidige aanpassingen (kleuren, fonts, layout) worden vervangen door de instellingen van deze preset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoadConfirm}>Laden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
