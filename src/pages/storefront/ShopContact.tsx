import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShopLayout } from '@/components/storefront/ShopLayout';
import { Helmet } from 'react-helmet-async';
import { usePublicStorefront } from '@/hooks/usePublicStorefront';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Send, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Naam is verplicht').max(100),
  email: z.string().trim().email('Ongeldig e-mailadres').max(255),
  subject: z.string().trim().min(1, 'Onderwerp is verplicht').max(200),
  message: z.string().trim().min(1, 'Bericht is verplicht').max(5000),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function ShopContact() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, isLoading } = usePublicStorefront(tenantSlug || '');
  const [form, setForm] = useState<ContactForm>({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof ContactForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactForm, string>> = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof ContactForm;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('storefront-contact-form', {
        body: {
          tenant_slug: tenantSlug,
          name: result.data.name,
          email: result.data.email,
          subject: result.data.subject,
          message: result.data.message,
        },
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      setErrors({ message: 'Er is iets misgegaan. Probeer het later opnieuw.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ShopLayout>
        <Helmet>
          <title>Bericht verzonden | {tenant?.name || 'Shop'}</title>
        </Helmet>
        <div className="container mx-auto px-4 py-16 max-w-lg text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-3">Bedankt voor je bericht!</h1>
          <p className="text-muted-foreground">
            We hebben je bericht ontvangen en proberen zo snel mogelijk te reageren.
          </p>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <Helmet>
        <title>Contact | {tenant?.name || 'Shop'}</title>
        <meta name="description" content={`Neem contact op met ${tenant?.name || 'ons'}`} />
      </Helmet>
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Contact</h1>
          <p className="text-muted-foreground">
            Heb je een vraag of opmerking? Stuur ons een bericht.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Naam *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="Je naam"
                    disabled={submitting}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="je@email.com"
                    disabled={submitting}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Onderwerp *</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={e => handleChange('subject', e.target.value)}
                  placeholder="Waar gaat je vraag over?"
                  disabled={submitting}
                />
                {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Bericht *</Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={e => handleChange('message', e.target.value)}
                  placeholder="Schrijf je bericht hier..."
                  rows={6}
                  disabled={submitting}
                />
                {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verzenden...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Verstuur bericht</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ShopLayout>
  );
}
