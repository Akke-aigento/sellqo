import { useState, useEffect } from 'react';
import { Store, ArrowRight, Loader2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { OnboardingTooltip } from '../OnboardingTooltip';
import { OnboardingData } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

interface WelcomeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  generateSlug: (name: string) => string;
  checkSlugAvailable: (slug: string) => Promise<boolean>;
}

export function WelcomeStep({
  data,
  updateData,
  onNext,
  generateSlug,
  checkSlugAvailable,
}: WelcomeStepProps) {
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Auto-generate slug when shop name changes
  useEffect(() => {
    if (data.shopName) {
      const slug = generateSlug(data.shopName);
      updateData({ shopSlug: slug });
    }
  }, [data.shopName, generateSlug, updateData]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!data.shopSlug) {
      setIsSlugAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true);
      setSlugError(null);
      
      try {
        const available = await checkSlugAvailable(data.shopSlug);
        setIsSlugAvailable(available);
        if (!available) {
          setSlugError('Deze URL is al in gebruik');
        }
      } catch (error) {
        setSlugError('Kon beschikbaarheid niet controleren');
      }
      
      setIsCheckingSlug(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [data.shopSlug, checkSlugAvailable]);

  const canContinue = data.shopName.trim().length >= 2 && isSlugAvailable === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canContinue) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Welkom bij Sellqo!</h2>
        <p className="text-muted-foreground">
          Laten we je webshop in 5 minuten opzetten. Begin met een naam voor je winkel.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="shopName">Winkelnaam *</Label>
            <OnboardingTooltip
              title="Winkelnaam"
              content="Je winkelnaam verschijnt op facturen, e-mails en in je webshop header. Kies een naam die je merk vertegenwoordigt."
            />
          </div>
          <Input
            id="shopName"
            value={data.shopName}
            onChange={(e) => updateData({ shopName: e.target.value })}
            placeholder="Bijv. Jouw Winkel"
            autoFocus
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="shopSlug">Winkel URL</Label>
            <OnboardingTooltip
              title="Winkel URL"
              content={
                <span>
                  Dit is het adres waar klanten je webshop bezoeken. 
                  De URL wordt automatisch gegenereerd op basis van je winkelnaam.
                </span>
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
              sellqo.app/shop/
            </div>
            <div className="relative flex-1">
              <Input
                id="shopSlug"
                value={data.shopSlug}
                onChange={(e) => updateData({ shopSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder="jouw-winkel"
                className={cn(
                  'rounded-l-none pr-10',
                  isSlugAvailable === true && 'border-green-500 focus-visible:ring-green-500',
                  isSlugAvailable === false && 'border-destructive focus-visible:ring-destructive'
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingSlug && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!isCheckingSlug && isSlugAvailable === true && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {!isCheckingSlug && isSlugAvailable === false && (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
          </div>
          {slugError && (
            <p className="text-sm text-destructive">{slugError}</p>
          )}
          {isSlugAvailable === true && (
            <p className="text-sm text-green-600">✓ Deze URL is beschikbaar</p>
          )}
        </div>
      </div>

      <div className="pt-4">
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!canContinue}
        >
          Volgende stap
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
