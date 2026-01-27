import { useState } from 'react';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Phone, MapPin, MessageSquare, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Bericht verzonden! We nemen zo snel mogelijk contact met je op.');
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <PublicPageLayout 
      title="Neem Contact Op" 
      subtitle="Vragen? We helpen je graag verder."
    >
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
        {/* Contact Form */}
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
          <h2 className="text-xl font-bold text-foreground mb-6">Stuur ons een bericht</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Naam *</Label>
                <Input id="name" placeholder="Je naam" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Bedrijf</Label>
                <Input id="company" placeholder="Bedrijfsnaam" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" placeholder="je@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Onderwerp *</Label>
              <Input id="subject" placeholder="Waar gaat je vraag over?" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Bericht *</Label>
              <Textarea 
                id="message" 
                placeholder="Beschrijf je vraag of opmerking..." 
                rows={5}
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Verzenden...' : 'Verstuur Bericht'}
            </Button>
          </form>
        </div>

        {/* Contact Info */}
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-6">Contact Informatie</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">E-mail</p>
                  <a href="mailto:hello@sellqo.com" className="text-muted-foreground hover:text-accent transition-colors">
                    hello@sellqo.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">WhatsApp</p>
                  <p className="text-muted-foreground">+32 123 45 67 89</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Adres</p>
                  <p className="text-muted-foreground">
                    SellQo BV<br />
                    België
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Reactietijd</p>
                  <p className="text-muted-foreground">Binnen 24 uur op werkdagen</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enterprise CTA */}
          <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-6">
            <h3 className="font-bold text-foreground mb-2">Enterprise Klant?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Voor grote implementaties en custom oplossingen bieden we persoonlijke begeleiding.
            </p>
            <Button variant="outline" className="w-full">
              Plan een Demo
            </Button>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
