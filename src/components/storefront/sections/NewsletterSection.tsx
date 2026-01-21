import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { HomepageSection, NewsletterContent } from '@/types/storefront';

interface NewsletterSectionProps {
  section: HomepageSection;
  tenantId?: string;
}

export function NewsletterSection({ section, tenantId }: NewsletterSectionProps) {
  const content = section.content as NewsletterContent;
  const settings = section.settings;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !tenantId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('newsletter-subscribe', {
        body: {
          tenantId,
          email,
          source: 'website',
        },
      });

      if (error) throw error;

      toast.success(data?.message || 'Bedankt voor je aanmelding!');
      setEmail('');
    } catch (error: any) {
      console.error('Newsletter subscribe error:', error);
      toast.error('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section 
      className="py-16"
      style={{
        backgroundColor: settings.background_color || 'hsl(var(--muted))',
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-xl mx-auto text-center">
          {(section.title || content.heading) && (
            <h2 className="text-3xl font-bold mb-4">
              {section.title || content.heading}
            </h2>
          )}
          {(section.subtitle || content.description) && (
            <p className="text-muted-foreground mb-8">
              {section.subtitle || content.description}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={content.placeholder || 'Jouw e-mailadres'}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? '...' : content.button_text || 'Aanmelden'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
