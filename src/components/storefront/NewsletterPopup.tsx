import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NewsletterPopupProps {
  tenantSlug: string;
  tenantId?: string;
  delaySeconds: number;
  incentiveText?: string | null;
}

const STORAGE_KEY = 'newsletter-popup-shown';

export function NewsletterPopup({ tenantSlug, tenantId, delaySeconds, incentiveText }: NewsletterPopupProps) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const key = `${STORAGE_KEY}-${tenantSlug}`;
    if (localStorage.getItem(key)) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, delaySeconds * 1000);

    return () => clearTimeout(timer);
  }, [tenantSlug, delaySeconds]);

  const handleClose = () => {
    localStorage.setItem(`${STORAGE_KEY}-${tenantSlug}`, '1');
    setVisible(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !tenantId) return;

    setIsSubmitting(true);
    try {
      // Try storefront API first
      const { error } = await supabase.functions.invoke('storefront-api', {
        body: {
          action: 'newsletter_subscribe',
          tenant_id: tenantId,
          email: email.trim(),
          source: 'popup',
        },
      });

      if (error) {
        // Fallback: insert directly into newsletter_subscribers
        const { error: insertError } = await supabase
          .from('newsletter_subscribers')
          .insert({
            tenant_id: tenantId,
            email: email.trim(),
            source: 'popup',
            status: 'active',
          });
        if (insertError && insertError.code !== '23505') {
          throw insertError;
        }
      }

      setSubmitted(true);
      localStorage.setItem(`${STORAGE_KEY}-${tenantSlug}`, '1');
      setTimeout(() => setVisible(false), 2000);
    } catch (err) {
      console.error('Newsletter signup error:', err);
      toast.error('Er ging iets mis. Probeer het later opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 p-8 text-center relative">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-primary/10 rounded-full p-3 w-fit mx-auto mb-4">
          <Mail className="h-6 w-6 text-primary" />
        </div>

        {submitted ? (
          <>
            <h2 className="text-xl font-bold mb-2">Bedankt!</h2>
            <p className="text-muted-foreground">Je bent succesvol ingeschreven.</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-2">Blijf op de hoogte</h2>
            <p className="text-muted-foreground mb-4">
              {incentiveText || 'Schrijf je in en ontvang als eerste onze nieuwste aanbiedingen en producten.'}
            </p>

            <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="je@email.nl"
                required
                className="flex-1 rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Bezig...' : 'Aanmelden'}
              </Button>
            </form>

            <button
              onClick={handleClose}
              className="mt-4 text-sm text-muted-foreground hover:underline"
            >
              Nee bedankt
            </button>
          </>
        )}
      </div>
    </div>
  );
}