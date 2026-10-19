import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ExitIntentPopupProps {
  tenantSlug: string;
  /** APP-CLEAN-3a: nodig om echt in te schrijven (newsletter_subscribe). */
  tenantId?: string;
  incentiveText?: string | null;
}

const SESSION_KEY = 'exit-intent-shown';

export function ExitIntentPopup({ tenantSlug, tenantId, incentiveText }: ExitIntentPopupProps) {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // MAIL-1a/1b: bij double opt-in eerst bevestigen via de mail.
  const [needsConfirm, setNeedsConfirm] = useState(false);

  // APP-CLEAN-3a: "Aanmelden" sloot tot nu toe alleen de popup; het e-mailadres
  // verdween. Nu dezelfde inschrijving als NewsletterPopup (met double opt-in in de API).
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !tenantId) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('storefront-api', {
        body: {
          action: 'newsletter_subscribe',
          tenant_id: tenantId,
          // MAIL-1b: storefront-api leest de velden uit `params` (r. ±5379); top-level
          // gaf altijd "email is required".
          params: { email: email.trim(), source: 'exit_intent', language: i18n.language },
        },
      });
      if (error) throw error;
      // Antwoord: { success, data: { requires_confirmation, ... } }
      const confirm = data?.data?.requires_confirmation === true;
      setNeedsConfirm(confirm);
      setSubmitted(true);
      // Bij bevestiging langer open, zodat de uitleg leesbaar is.
      setTimeout(() => setVisible(false), confirm ? 6000 : 2000);
    } catch (err) {
      console.error('Newsletter signup error:', err);
      toast.error(t('storefront.newsletter.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const key = `${SESSION_KEY}-${tenantSlug}`;
    if (sessionStorage.getItem(key)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        sessionStorage.setItem(key, '1');
        setVisible(true);
      }
    };

    // Only attach after a delay so it doesn't trigger immediately
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 5000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [tenantSlug]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 p-8 text-center relative">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <>
            <h2 className="text-xl font-bold mb-2">
              {needsConfirm ? t('storefront.newsletter.confirm_title') : t('storefront.newsletterPopup.bedankt')}
            </h2>
            <p className="text-muted-foreground">
              {needsConfirm ? t('storefront.newsletter.confirm_body') : t('storefront.newsletterPopup.je_bent_succesvol_ingeschreven')}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-3">{t('storefront.exitIntentPopup.wacht_even')}</h2>
            <p className="text-muted-foreground mb-6">
              {incentiveText || 'Schrijf je in voor onze nieuwsbrief en ontvang exclusieve aanbiedingen!'}
            </p>

            <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('storefront.exitIntentPopup.je_email_nl')}
                className="flex-1 rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={isSubmitting || !tenantId}>
                {t('storefront.exitIntentPopup.aanmelden')}
              </Button>
            </form>
          </>
        )}

        <button
          onClick={() => setVisible(false)}
          className="mt-4 text-sm text-muted-foreground hover:underline"
        >
          {t('storefront.exitIntentPopup.nee_bedankt')}
        </button>
      </div>
    </div>
  );
}
