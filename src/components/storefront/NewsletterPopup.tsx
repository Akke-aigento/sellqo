import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface NewsletterPopupProps {
  tenantSlug: string;
  tenantId?: string;
  delaySeconds: number;
  incentiveText?: string | null;
}

const STORAGE_KEY = 'newsletter-popup-shown';

export function NewsletterPopup({ tenantSlug, tenantId, delaySeconds, incentiveText }: NewsletterPopupProps) {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // MAIL-1a/1b: bij double opt-in eerst bevestigen via de mail.
  const [needsConfirm, setNeedsConfirm] = useState(false);
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
      const { data, error } = await supabase.functions.invoke('storefront-api', {
        body: {
          action: 'newsletter_subscribe',
          tenant_id: tenantId,
          // MAIL-1b: storefront-api leest de velden uit `params` (r. ±5379); top-level
          // gaf altijd "email is required".
          params: { email: email.trim(), source: 'popup', language: i18n.language },
        },
      });

      if (error) throw error;
      // Antwoord: { success, data: { requires_confirmation, ... } }
      const confirm = data?.data?.requires_confirmation === true;
      setNeedsConfirm(confirm);

      setSubmitted(true);
      localStorage.setItem(`${STORAGE_KEY}-${tenantSlug}`, '1');
      // Bij bevestiging langer open, zodat de uitleg leesbaar is.
      setTimeout(() => setVisible(false), confirm ? 6000 : 2000);
    } catch (err) {
      console.error('Newsletter signup error:', err);
      toast.error(t('storefront.newsletter.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
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
            <h2 className="text-xl font-bold mb-2">
              {needsConfirm ? t('storefront.newsletter.confirm_title') : t('storefront.newsletterPopup.bedankt')}
            </h2>
            <p className="text-muted-foreground">
              {needsConfirm ? t('storefront.newsletter.confirm_body') : t('storefront.newsletterPopup.je_bent_succesvol_ingeschreven')}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-2">{t('storefront.newsletterPopup.blijf_op_de_hoogte')}</h2>
            <p className="text-muted-foreground mb-4">
              {incentiveText || t('storefront.newsletterPopup.default_incentive')}
            </p>

            <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('storefront.exitIntentPopup.je_email_nl')}
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
              {t('storefront.exitIntentPopup.nee_bedankt')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}