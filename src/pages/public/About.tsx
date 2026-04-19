import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Target, Users, Zap, Heart, Globe, Shield, Store, ShoppingBag, Euro, CheckCircle, Building2, Rocket, Award, TrendingUp } from 'lucide-react';

const stats = [
  { icon: Store, value: '1.000+', label: 'Actieve Shops' },
  { icon: ShoppingBag, value: '500.000+', label: 'Bestellingen Verwerkt' },
  { icon: Euro, value: '€10M+', label: 'Omzet Gefaciliteerd' },
  { icon: CheckCircle, value: '99.9%', label: 'Uptime' },
];

const timeline = [
  { date: 'Q1 2024', title: 'SellQo Opgericht', description: 'Start in België met een visie voor betere e-commerce tools.', icon: Rocket },
  { date: 'Q3 2024', title: 'Eerste Beta Testers', description: '50+ ondernemers testen het platform en geven feedback.', icon: Users },
  { date: 'Q4 2024', title: 'Bol.com Integratie Live', description: 'Officiële marketplace integratie gelanceerd.', icon: ShoppingBag },
  { date: 'Q1 2025', title: 'Publieke Launch', description: 'Platform open voor alle ondernemers met AI-features.', icon: Award },
  { date: '2025+', title: 'Internationale Expansie', description: 'Uitbreiding naar Nederland en rest van Europa.', icon: Globe },
];

const values = [
  {
    icon: Target,
    title: 'Eenvoud Eerst',
    description: 'Complexe e-commerce processen versimpelen tot intuïtieve workflows.',
  },
  {
    icon: Users,
    title: 'Ondernemers Centraal',
    description: 'Elke feature is ontworpen met MKB ondernemers in gedachten.',
  },
  {
    icon: Zap,
    title: 'Innovatie Door AI',
    description: 'Slimme automatisering die jou tijd bespaart en groei stimuleert.',
  },
  {
    icon: Heart,
    title: 'Made in Belgium',
    description: 'Met trots ontwikkeld in België, voor de Benelux markt.',
  },
  {
    icon: Globe,
    title: 'Lokaal & Globaal',
    description: 'Ondersteuning voor lokale betaalmethoden én internationale groei.',
  },
  {
    icon: Shield,
    title: 'Privacy & Veiligheid',
    description: 'GDPR-compliant met focus op databescherming en transparantie.',
  },
];

const team = [
  { name: 'Founder & CEO', role: 'Strategie & Visie', avatar: '👨‍💼' },
  { name: 'CTO', role: 'Techniek & Product', avatar: '👨‍💻' },
  { name: 'Head of Design', role: 'UX & Branding', avatar: '👩‍🎨' },
  { name: 'Lead Developer', role: 'Full-Stack Development', avatar: '👨‍🔧' },
];

const pressLogos = [
  { name: 'De Tijd', placeholder: 'DE TIJD' },
  { name: 'Tweakers', placeholder: 'TWEAKERS' },
  { name: 'Sprout', placeholder: 'SPROUT' },
  { name: 'Emerce', placeholder: 'EMERCE' },
];

export default function About() {
  return (
    <PublicPageLayout 
      title="Over SellQo" 
      subtitle="De Belgische e-commerce oplossing die groeit met jouw ambities"
    >
      {/* Mission Section */}
      <section className="max-w-4xl mx-auto mb-16">
        <div className="bg-card rounded-2xl border border-border p-8 md:p-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Onze Missie</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Bij SellQo geloven we dat elk bedrijf, groot of klein, toegang verdient tot professionele 
            e-commerce tools. We bouwen de meest complete en gebruiksvriendelijke oplossing voor 
            ondernemers in de Benelux - van eerste product tot internationale expansie.
          </p>
          <p className="text-muted-foreground">
            Opgericht in 2024, combineert SellQo de kracht van AI met diepgaande kennis van de lokale 
            markt. Of je nu verkoopt via je eigen webshop, Bol.com, Amazon of fysieke winkel - wij 
            brengen alles samen in één platform.
          </p>
          <p className="text-muted-foreground mt-4 pt-4 border-t border-border text-sm">
            <span className="font-medium text-foreground">Legal entity:</span> SellQo is a SaaS product
            developed and operated by <span className="font-medium text-foreground">Nomadix BV</span>,
            a Belgian company registered under VAT/company number BE 1017.500.207, with registered
            office at Beekstraat 49, 3051 Oud-Heverlee, Belgium. Contact:{' '}
            <a href="mailto:info@sellqo.app" className="text-accent hover:underline">info@sellqo.app</a>.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-5xl mx-auto mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-xl border border-accent/30 p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-3">
                <stat.icon className="w-6 h-6 text-accent" />
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground mb-1">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline Section */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Onze Reis</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 md:left-1/2 md:-translate-x-0.5 top-0 bottom-0 w-0.5 bg-border" />
          
          {timeline.map((item, index) => (
            <div 
              key={index}
              className={`relative flex items-start gap-6 mb-8 ${
                index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              }`}
            >
              {/* Timeline dot */}
              <div className="absolute left-4 md:left-1/2 md:-translate-x-1/2 w-8 h-8 rounded-full bg-accent flex items-center justify-center z-10">
                <item.icon className="w-4 h-4 text-accent-foreground" />
              </div>
              
              {/* Content */}
              <div className={`ml-16 md:ml-0 md:w-[calc(50%-2rem)] ${
                index % 2 === 0 ? 'md:pr-8 md:text-right' : 'md:pl-8'
              }`}>
                <span className="text-sm font-medium text-accent">{item.date}</span>
                <h3 className="text-lg font-semibold text-foreground mt-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Values Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Onze Waarden</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((value, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <value.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Het Team</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {team.map((member, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-6 text-center hover:border-accent/50 transition-colors"
            >
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4 text-4xl">
                {member.avatar}
              </div>
              <h3 className="font-semibold text-foreground">{member.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{member.role}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Een klein maar toegewijd team van ontwikkelaars, designers en e-commerce experts.
        </p>
      </section>

      {/* Press/Featured Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">In de Media</h2>
        <p className="text-center text-muted-foreground mb-8">Bekende namen schrijven over SellQo</p>
        <div className="flex flex-wrap justify-center gap-6 max-w-3xl mx-auto">
          {pressLogos.map((press, index) => (
            <div 
              key={index}
              className="bg-secondary/50 rounded-lg px-8 py-4 text-muted-foreground font-bold text-lg tracking-wider opacity-60 hover:opacity-100 transition-opacity"
            >
              {press.placeholder}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Klaar om te starten?
        </h2>
        <p className="text-muted-foreground mb-6">
          Probeer SellQo 14 dagen gratis en ontdek het verschil.
        </p>
        <Button asChild size="lg">
          <Link to="/auth?mode=register">Start Gratis Trial</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
