import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Handshake, Users, TrendingUp, Gift, Briefcase, HeartHandshake, Euro, Calculator, Star, Quote } from 'lucide-react';
import { toast } from 'sonner';

const partnerTypes = [
  {
    icon: Briefcase,
    title: 'Agency Partners',
    description: 'Voor webdesign en marketing bureaus die SellQo aan klanten willen aanbieden.',
    benefits: ['Commissie op doorverwijzingen', 'Prioriteit support', 'Co-marketing mogelijkheden'],
  },
  {
    icon: TrendingUp,
    title: 'Reseller Partners',
    description: 'Verkoop SellQo licenties aan je eigen klantenbase met aantrekkelijke marges.',
    benefits: ['Volume kortingen', 'White-label opties', 'Dedicated account manager'],
  },
  {
    icon: HeartHandshake,
    title: 'Technology Partners',
    description: 'Integreer je software of dienst met het SellQo platform.',
    benefits: ['API toegang', 'Technische ondersteuning', 'Marketplace listing'],
  },
];

const benefits = [
  { icon: Gift, title: 'Aantrekkelijke Commissies', description: 'Verdien tot 20% recurring commissie op doorverwezen klanten.' },
  { icon: Users, title: 'Dedicated Support', description: 'Direct contact met ons partner team voor al je vragen.' },
  { icon: TrendingUp, title: 'Groei Samen', description: 'Toegang tot training, marketing materialen en co-branding.' },
];

const partnerLogos = [
  { name: 'Agency One', placeholder: 'AGENCY 1' },
  { name: 'WebDesign Pro', placeholder: 'WEB PRO' },
  { name: 'Digital Masters', placeholder: 'DIGITAL' },
  { name: 'Growth Agency', placeholder: 'GROWTH' },
  { name: 'E-com Experts', placeholder: 'E-COM' },
  { name: 'Tech Solutions', placeholder: 'TECH' },
];

const testimonials = [
  {
    quote: 'Dankzij het SellQo partner programma kunnen we onze klanten een complete e-commerce oplossing bieden zonder zelf te moeten ontwikkelen.',
    author: 'Mark Peeters',
    company: 'WebDesign Pro',
    role: 'Managing Director',
  },
  {
    quote: 'De commissiestructuur en support zijn uitstekend. We hebben al 15 klanten succesvol doorverwezen.',
    author: 'Sarah Claes',
    company: 'Digital Masters',
    role: 'Partner Manager',
  },
];

export default function Partners() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientEstimate, setClientEstimate] = useState([5]);
  const [partnerType, setPartnerType] = useState('');

  // Calculate estimated earnings
  const avgClientValue = 79; // euros per month
  const commissionRate = 0.20; // 20%
  const estimatedEarnings = clientEstimate[0] * avgClientValue * commissionRate;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Bedankt voor je aanmelding! We nemen binnen 48 uur contact met je op.');
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
    setPartnerType('');
  };

  return (
    <PublicPageLayout 
      title="Partner Programma" 
      subtitle="Groei samen met SellQo en help ondernemers succesvol verkopen"
    >
      {/* Partner Types */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Word Partner</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {partnerTypes.map((type, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <type.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{type.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{type.description}</p>
              <ul className="space-y-2">
                {type.benefits.map((benefit, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Commission Calculator */}
      <section className="max-w-3xl mx-auto mb-16">
        <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Commissie Calculator</h2>
              <p className="text-sm text-muted-foreground">Bereken je potentiële verdiensten</p>
            </div>
          </div>
          
          <div className="mb-6">
            <Label className="text-foreground mb-4 block">
              Hoeveel klanten verwacht je door te verwijzen per jaar?
            </Label>
            <Slider
              value={clientEstimate}
              onValueChange={setClientEstimate}
              min={1}
              max={50}
              step={1}
              className="mb-2"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1 klant</span>
              <span className="font-medium text-foreground">{clientEstimate[0]} klanten</span>
              <span>50 klanten</span>
            </div>
          </div>

          <div className="bg-background rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Geschatte jaarlijkse commissie</p>
            <p className="text-4xl font-bold text-accent">€{(estimatedEarnings * 12).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Gebaseerd op 20% commissie en €79/maand gemiddelde klantwaarde
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-4xl mx-auto mb-16">
        <div className="bg-secondary/30 rounded-2xl border border-border p-8">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Partner Voordelen</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Current Partners */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">Onze Partners</h2>
        <p className="text-center text-muted-foreground mb-8">Bedrijven die al samenwerken met SellQo</p>
        <div className="flex flex-wrap justify-center gap-4">
          {partnerLogos.map((partner, index) => (
            <div 
              key={index}
              className="bg-secondary/50 rounded-lg px-6 py-4 text-muted-foreground font-bold text-sm tracking-wider opacity-60 hover:opacity-100 transition-opacity"
            >
              {partner.placeholder}
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Wat Partners Zeggen</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card rounded-xl border border-border p-6">
              <Quote className="w-8 h-8 text-accent/30 mb-4" />
              <p className="text-foreground mb-4 italic">"{testimonial.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg">
                  {testimonial.author.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Application Form */}
      <section className="max-w-2xl mx-auto mb-16">
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
          <h2 className="text-xl font-bold text-foreground text-center mb-2">Word Partner</h2>
          <p className="text-center text-muted-foreground mb-6">
            Vul het formulier in en we nemen binnen 48 uur contact met je op.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Bedrijfsnaam *</Label>
                <Input id="company-name" placeholder="Je bedrijf" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-name">Contactpersoon *</Label>
                <Input id="contact-name" placeholder="Je naam" required />
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner-email">E-mail *</Label>
                <Input id="partner-email" type="email" placeholder="email@bedrijf.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" placeholder="https://jouwbedrijf.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-type">Type Partnership *</Label>
              <Select value={partnerType} onValueChange={setPartnerType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency Partner</SelectItem>
                  <SelectItem value="reseller">Reseller Partner</SelectItem>
                  <SelectItem value="technology">Technology Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-message">Vertel ons meer over je bedrijf</Label>
              <Textarea 
                id="partner-message"
                placeholder="Wat doet je bedrijf en hoe zie je de samenwerking met SellQo?"
                rows={4}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Verzenden...' : 'Aanmelding Versturen'}
            </Button>
          </form>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Vragen over het programma?
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
          Neem contact met ons op voor meer informatie over de partnermogelijkheden.
        </p>
        <Button asChild variant="outline" size="lg">
          <Link to="/contact">Neem Contact Op</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
