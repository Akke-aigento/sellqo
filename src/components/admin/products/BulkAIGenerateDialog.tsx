import { useState } from 'react';
import { Sparkles, Loader2, Check, X, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAICredits } from '@/hooks/useAICredits';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  short_description?: string | null;
  description?: string | null;
  category_id?: string | null;
  price: number;
  weight?: number | null;
  tags?: string[];
  meta_title?: string | null;
  meta_description?: string | null;
}

interface BulkAIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  categories?: { id: string; name: string }[];
  onComplete: () => void;
}

type FieldType = 'meta_title' | 'meta_description' | 'short_description';

const FIELD_OPTIONS: { value: FieldType; label: string; credits: number }[] = [
  { value: 'meta_description', label: 'Meta beschrijving', credits: 1 },
  { value: 'meta_title', label: 'Meta titel', credits: 1 },
  { value: 'short_description', label: 'Korte beschrijving', credits: 1 },
];

interface GeneratedResult {
  productId: string;
  productName: string;
  text: string;
  accepted: boolean;
}

export function BulkAIGenerateDialog({
  open,
  onOpenChange,
  products,
  categories = [],
  onComplete,
}: BulkAIGenerateDialogProps) {
  const { hasCredits, refetch: refetchCredits } = useAICredits();
  const { checkFeature } = useUsageLimits();
  const [fieldType, setFieldType] = useState<FieldType>('meta_description');
  const [briefing, setBriefing] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'config' | 'review'>('config');

  const hasAI = checkFeature('ai_copywriting');
  const totalCredits = products.length;

  const handleGenerate = async () => {
    if (!hasCredits(totalCredits)) {
      toast.error(`Niet genoeg credits. Je hebt ${totalCredits} credits nodig.`);
      return;
    }

    setIsGenerating(true);
    setResults([]);
    const generated: GeneratedResult[] = [];

    for (const product of products) {
      try {
        const context = {
          name: product.name,
          short_description: product.short_description || undefined,
          description: product.description || undefined,
          category_name: categories.find(c => c.id === product.category_id)?.name,
          price: product.price,
          weight: product.weight,
          tags: product.tags,
        };

        const { data, error } = await supabase.functions.invoke('ai-product-field-assistant', {
          body: {
            fieldType,
            currentValue: '',
            action: 'auto_generate',
            briefing: briefing || undefined,
            language: 'nl',
            productContext: context,
          },
        });

        if (error) throw error;

        generated.push({
          productId: product.id,
          productName: product.name,
          text: data?.text || '',
          accepted: true,
        });
      } catch (err) {
        console.error(`Error generating for ${product.name}:`, err);
        generated.push({
          productId: product.id,
          productName: product.name,
          text: '',
          accepted: false,
        });
      }
    }

    setResults(generated);
    setCurrentIndex(0);
    setStep('review');
    setIsGenerating(false);
    refetchCredits();
  };

  const toggleAccept = (index: number) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, accepted: !r.accepted } : r));
  };

  const handleSave = async () => {
    const accepted = results.filter(r => r.accepted && r.text);
    if (accepted.length === 0) {
      toast.error('Geen voorstellen geselecteerd om op te slaan.');
      return;
    }

    setIsSaving(true);
    try {
      const fieldMap: Record<FieldType, string> = {
        meta_title: 'meta_title',
        meta_description: 'meta_description',
        short_description: 'short_description',
      };

      for (const item of accepted) {
        await supabase
          .from('products')
          .update({ [fieldMap[fieldType]]: item.text })
          .eq('id', item.productId);
      }

      toast.success(`${accepted.length} producten bijgewerkt!`);
      onComplete();
      handleClose();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Fout bij opslaan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setResults([]);
    setStep('config');
    setBriefing('');
    setCurrentIndex(0);
    onOpenChange(false);
  };

  if (!hasAI) return null;

  const acceptedCount = results.filter(r => r.accepted && r.text).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Bulk AI generatie
          </DialogTitle>
          <DialogDescription>
            Genereer AI-teksten voor {products.length} producten
          </DialogDescription>
        </DialogHeader>

        {step === 'config' ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Welk veld wil je genereren?</label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Extra instructie (optioneel)</label>
              <Textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder="Bijv. 'focus op duurzaamheid' of 'noem altijd de prijs'"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <Badge variant="outline">{totalCredits} credits</Badge>
              <span className="text-sm text-muted-foreground">
                voor {products.length} producten
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {results.length}
              </span>
              <Badge variant={acceptedCount > 0 ? 'default' : 'outline'}>
                {acceptedCount} geaccepteerd
              </Badge>
            </div>

            {results[currentIndex] && (
              <div className={cn(
                "flex-1 border rounded-lg p-4 space-y-2 transition-colors",
                results[currentIndex].accepted ? "border-primary/30 bg-primary/5" : "border-muted opacity-60"
              )}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">{results[currentIndex].productName}</p>
                  <Button
                    variant={results[currentIndex].accepted ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAccept(currentIndex)}
                  >
                    {results[currentIndex].accepted ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                    {results[currentIndex].accepted ? 'Geaccepteerd' : 'Overgeslagen'}
                  </Button>
                </div>
                <ScrollArea className="max-h-40">
                  <p className="text-sm">
                    {results[currentIndex].text || <span className="text-muted-foreground italic">Geen resultaat</span>}
                  </p>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Vorige
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex(i => Math.min(results.length - 1, i + 1))}
                disabled={currentIndex >= results.length - 1}
              >
                Volgende
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isGenerating || isSaving}>
            Annuleren
          </Button>
          {step === 'config' ? (
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Genereren ({results.length}/{products.length})...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Genereer voor {products.length} producten
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={isSaving || acceptedCount === 0}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {acceptedCount} voorstellen opslaan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
