import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Heart, Rocket, Coffee, MapPin, Clock, Users, Code, Palette, Headphones, TrendingUp, CheckCircle, Send, GraduationCap, Home, Euro, Laptop, Calendar } from 'lucide-react';

const perks = [
  { icon: Home, title: 'Remote-First', description: 'Werk vanuit huis of waar je maar wilt in België/Nederland.' },
  { icon: Clock, title: 'Flexibele Uren', description: 'Eigen indeling, zolang het werk gedaan wordt.' },
  { icon: Laptop, title: 'Moderne Tools', description: 'MacBook, JetBrains, Figma - de beste tools tot je beschikking.' },
  { icon: GraduationCap, title: 'Leerbudget', description: '€1.500/jaar voor cursussen, conferenties en boeken.' },
  { icon: Euro, title: 'Competitief Salaris', description: 'Marktconform met bonus en groei-mogelijkheden.' },
  { icon: Calendar, title: '30 Vakantiedagen', description: 'Plus nationale feestdagen en flexibele verlofdagen.' },
  { icon: Rocket, title: 'Startup Cultuur', description: 'Direct impact, snelle beslissingen, geen bureaucratie.' },
  { icon: Heart, title: 'Team Events', description: 'Maandelijkse meetups, jaarlijkse team retreat.' },
];

const departments = [
  { id: 'all', label: 'Alle Afdelingen', icon: Briefcase },
  { id: 'engineering', label: 'Engineering', icon: Code },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'support', label: 'Support', icon: Headphones },
  { id: 'marketing', label: 'Marketing', icon: TrendingUp },
];

const openPositions = [
  {
    title: 'Senior Full-Stack Developer',
    department: 'engineering',
    location: 'Remote (BE/NL)',
    type: 'Full-time',
    description: 'Bouw mee aan het SellQo platform met React, TypeScript en Supabase.',
    requirements: ['5+ jaar ervaring', 'React/TypeScript', 'PostgreSQL', 'Team player'],
  },
  {
    title: 'Product Designer',
    department: 'design',
    location: 'Hybrid (Brussel)',
    type: 'Full-time',
    description: 'Ontwerp intuïtieve interfaces voor duizenden e-commerce ondernemers.',
    requirements: ['3+ jaar UX/UI', 'Figma expert', 'User research', 'Design systems'],
  },
  {
    title: 'Customer Success Manager',
    department: 'support',
    location: 'Remote (BE/NL)',
    type: 'Full-time',
    description: 'Help onze klanten succesvol worden met SellQo.',
    requirements: ['2+ jaar CS/Support', 'E-commerce kennis', 'Empathisch', 'Probleemoplosser'],
  },
];

const hiringProcess = [
  { step: 1, title: 'Sollicitatie', description: 'Stuur je CV en motivatie via het formulier.', duration: '5 min' },
  { step: 2, title: 'Eerste Gesprek', description: 'Kennismaking met HR over cultuur en verwachtingen.', duration: '30 min' },
  { step: 3, title: 'Technische Ronde', description: 'Gesprek met je toekomstige collega\'s over skills.', duration: '60 min' },
  { step: 4, title: 'Case/Opdracht', description: 'Een kleine opdracht om je werkwijze te zien.', duration: '2-4 uur' },
  { step: 5, title: 'Founder Chat', description: 'Laatste gesprek met de oprichters.', duration: '30 min' },
  { step: 6, title: 'Aanbod', description: 'We doen je een mooi voorstel!', duration: '🎉' },
];

const dayInLife = [
  { time: '09:00', activity: 'Start dag, check Slack en plan taken' },
  { time: '09:30', activity: 'Daily standup met je team (15 min)' },
  { time: '10:00', activity: 'Focus tijd: bouwen aan features' },
  { time: '12:30', activity: 'Lunch (remote: eigen tijd, kantoor: samen)' },
  { time: '13:30', activity: 'Meetings, code reviews, samenwerking' },
  { time: '15:00', activity: 'Meer focus tijd of pair programming' },
  { time: '17:00', activity: 'Afronden, notities voor morgen' },
];

export default function Careers() {
  const [activeDepartment, setActiveDepartment] = useState('all');

  const filteredPositions = activeDepartment === 'all'
    ? openPositions
    : openPositions.filter(p => p.department === activeDepartment);

  return (
    <PublicPageLayout 
      title="Werken bij SellQo" 
      subtitle="Bouw mee aan de toekomst van e-commerce in de Benelux"
    >
      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center mb-16">
        <p className="text-lg text-muted-foreground">
          Bij SellQo bouwen we software die duizenden ondernemers helpt hun dromen waar te maken. 
          We zoeken gepassioneerde mensen die willen bijdragen aan iets betekenisvols.
        </p>
      </section>

      {/* Perks Grid */}
      <section className="max-w-5xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Wat we bieden</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {perks.map((perk, index) => (
            <div 
              key={index}
              className="bg-card rounded-xl border border-border p-5 hover:border-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <perk.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{perk.title}</h3>
              <p className="text-sm text-muted-foreground">{perk.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open Positions */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Open Posities</h2>
        
        {/* Department Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {departments.map((dept) => (
            <button
              key={dept.id}
              onClick={() => setActiveDepartment(dept.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeDepartment === dept.id
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <dept.icon className="w-4 h-4" />
              {dept.label}
            </button>
          ))}
        </div>

        {/* Positions List */}
        {filteredPositions.length > 0 ? (
          <div className="space-y-4">
            {filteredPositions.map((position, index) => (
              <div 
                key={index}
                className="bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{position.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {position.location}
                      </span>
                      <Badge variant="outline">{position.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{position.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {position.requirements.map((req, i) => (
                        <span key={i} className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button asChild className="shrink-0">
                    <Link to="/contact">
                      <Send className="w-4 h-4 mr-2" />
                      Solliciteer
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-secondary/30 rounded-2xl p-12 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Geen openstaande posities in deze afdeling op dit moment.
            </p>
          </div>
        )}
      </section>

      {/* Hiring Process */}
      <section className="max-w-4xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Sollicitatieproces</h2>
        <div className="relative">
          {/* Horizontal line */}
          <div className="hidden md:block absolute top-8 left-0 right-0 h-0.5 bg-border" />
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {hiringProcess.map((step, index) => (
              <div key={index} className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center mx-auto mb-3 relative z-10 bg-background">
                  <span className="text-lg font-bold text-accent">{step.step}</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground mb-1">{step.description}</p>
                <span className="text-xs text-accent">{step.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Day in the Life */}
      <section className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Een Dag bij SellQo</h2>
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="space-y-4">
            {dayInLife.map((item, index) => (
              <div key={index} className="flex items-start gap-4">
                <span className="text-sm font-mono text-accent w-14 shrink-0">{item.time}</span>
                <div className="flex-1 pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-foreground">{item.activity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Geïnteresseerd in SellQo?
        </h2>
        <p className="text-muted-foreground mb-6">
          Ook als er geen passende vacature is, staan we open voor talent. Stuur ons een bericht!
        </p>
        <Button asChild size="lg">
          <Link to="/contact">Spontaan Solliciteren</Link>
        </Button>
      </section>
    </PublicPageLayout>
  );
}
