import { useState } from 'react';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Phone, MapPin, MessageSquare, Clock, Calendar, Headphones, Building2, Zap } from 'lucide-react';
import { toast } from 'sonner';

const subjects = [
  { value: 'sales', label: 'Verkoop & Prijzen', responseTime: '< 4 uur' },
  { value: 'support', label: 'Technische Support', responseTime: '< 24 uur' },
  { value: 'partnership', label: 'Partnership', responseTime: '< 48 uur' },
  { value: 'technical', label: 'API & Integraties', responseTime: '< 24 uur' },
  { value: 'other', label: 'Anders', responseTime: '< 48 uur' },
];

const contactMethods = [
  {
    icon: Mail,
    title: 'E-mail',
    value: 'hello@sellqo.app',
    href: 'mailto:hello@sellqo.app',
    description: 'Voor algemene vragen',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp',
    value: '+32 123 45 67 89',
    href: 'https://wa.me/3212345678',
    description: 'Snelle antwoorden',
  },
  {
    icon: Phone,
    title: 'Telefoon',
    value: '+32 123 45 67 89',
    href: 'tel:+3212345678',
    description: 'Ma-Vr 9:00-17:00',
  },
];

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Bericht verzonden! We nemen zo snel mogelijk contact met je op.');
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
    setSelectedSubject('');
  };

  const currentSubject = subjects.find(s => s.value === selectedSubject);

  return (
    <PublicPageLayout 
      title="Neem Contact Op" 
      subtitle="Vragen? We helpen je graag verder."
    >
      {/* Quick Contact Methods */}
      <section className="max-w-4xl mx-auto mb-12">
        <div className="grid sm:grid-cols-3 gap-4">
          {contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.href}
              className="bg-card rounded-xl border border-border p-5 hover:border-accent/50 transition-colors group text-center"
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-accent/20 transition-colors">
                <method.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{method.title}</h3>
              <p className="text-accent text-sm mb-1">{method.value}</p>
              <p className="text-xs text-muted-foreground">{method.description}</p>
            </a>
          ))}
        </div>
      </section>

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
              <Select value={selectedSubject} onValueChange={setSelectedSubject} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een onderwerp" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentSubject && (
                <p className="text-xs text-accent flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Verwachte reactietijd: {currentSubject.responseTime}
                </p>
              )}
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

        {/* Contact Info & Options */}
        <div className="space-y-6">
          {/* Response Times */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Reactietijden</h2>
            <div className="space-y-3">
              {subjects.map((subject) => (
                <div key={subject.value} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-foreground">{subject.label}</span>
                  <span className="text-sm text-accent font-medium">{subject.responseTime}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Company Information — legal entity */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Company Information</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  SellQo is operated by:
                </p>
                <p className="text-foreground text-sm leading-relaxed mt-2">
                  <span className="font-medium">Nomadix BV</span><br />
                  Beekstraat 49<br />
                  3051 Oud-Heverlee, Belgium<br />
                  Company number: BE 1017.500.207<br />
                  Email:{' '}
                  <a href="mailto:info@sellqo.app" className="text-accent hover:underline">
                    info@sellqo.app
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Enterprise CTA */}
          <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">Enterprise Klant?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Voor grote implementaties en custom oplossingen bieden we persoonlijke begeleiding.
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <a href="https://calendly.com" target="_blank" rel="noopener noreferrer">
                    <Calendar className="w-4 h-4 mr-2" />
                    Plan een Demo
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Live Chat Placeholder */}
          <div className="bg-secondary/30 rounded-2xl border border-border p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Headphones className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Live Chat</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Binnenkort beschikbaar voor directe hulp
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
              <Zap className="w-3 h-3" />
              Coming soon
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
