import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePromptFavorites } from '@/hooks/usePromptFavorites';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PromptFavoriteButtonProps {
  promptType: 'social' | 'email' | 'image';
  promptText: string;
  settings?: Record<string, unknown>;
  className?: string;
}

export function PromptFavoriteButton({ 
  promptType, 
  promptText, 
  settings,
  className 
}: PromptFavoriteButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const { createFavorite, favorites } = usePromptFavorites(promptType);

  const isFavorited = favorites.some(f => f.prompt_text === promptText);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Geef een naam op');
      return;
    }

    try {
      await createFavorite.mutateAsync({
        name: name.trim(),
        prompt_type: promptType,
        prompt_text: promptText,
        settings,
      });
      setDialogOpen(false);
      setName('');
    } catch {
      // Error handled in hook
    }
  };

  if (isFavorited) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('text-yellow-500', className)}
        disabled
        title="Al opgeslagen als favoriet"
      >
        <Star className="h-4 w-4 fill-current" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={className}
        onClick={() => setDialogOpen(true)}
        title="Opslaan als favoriet"
      >
        <Star className="h-4 w-4" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Prompt opslaan als favoriet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Naam</Label>
              <Input
                placeholder="Geef deze prompt een naam..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="p-3 rounded-lg bg-muted text-sm">
              <p className="font-medium mb-1">Prompt preview:</p>
              <p className="text-muted-foreground line-clamp-3">{promptText}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={createFavorite.isPending}>
              {createFavorite.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Star className="h-4 w-4 mr-2" />
              )}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
