import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, ExternalLink, Copy, Check, Package, Truck, Palette, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CelebrationConfetti } from '../CelebrationConfetti';
import { useTenant } from '@/hooks/useTenant';

interface LaunchStepProps {
  onComplete: () => void;
}

export function LaunchStep({ onComplete }: LaunchStepProps) {
  const { currentTenant } = useTenant();
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const shopUrl = currentTenant?.slug 
    ? `${window.location.origin}/shop/${currentTenant.slug}`
    : null;

  useEffect(() => {
    // Trigger confetti after a short delay
    const timer = setTimeout(() => {
      setShowConfetti(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const copyToClipboard = async () => {
    if (!shopUrl) return;
    
    try {
      await navigator.clipboard.writeText(shopUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const nextSteps = [
    {
      icon: Package,
      title: 'Meer producten toevoegen',
      description: 'Breid je catalogus uit met meer producten',
      link: '/admin/products',
    },
    {
      icon: Truck,
      title: 'Verzendmethoden instellen',
      description: 'Configureer verzendopties en tarieven',
      link: '/admin/settings?tab=shipping',
    },
    {
      icon: Palette,
      title: 'Theme aanpassen',
      description: 'Pas de kleuren en stijl van je webshop aan',
      link: '/admin/settings?tab=storefront',
    },
    {
      icon: FileText,
      title: 'Juridische pagina\'s',
      description: 'Genereer je algemene voorwaarden en privacy beleid',
      link: '/admin/settings?tab=legal',
    },
  ];

  return (
    <div className="space-y-8">
      <CelebrationConfetti trigger={showConfetti} />

      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4 animate-bounce">
          <Rocket className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Je webshop is LIVE! 🎉</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Gefeliciteerd! Je bent nu klaar om je eerste orders te ontvangen. 
          Deel je winkel met de wereld!
        </p>
      </div>

      {shopUrl && (
        <Card className="max-w-md mx-auto">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate">
                {shopUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button asChild className="flex-shrink-0">
                <a href={shopUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center">Volgende stappen (optioneel)</h3>
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto">
          {nextSteps.map((step) => (
            <Link key={step.link} to={step.link} onClick={onComplete}>
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm group-hover:text-primary transition-colors">
                        {step.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="pt-4 text-center">
        <Button size="lg" onClick={onComplete}>
          Ga naar Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
