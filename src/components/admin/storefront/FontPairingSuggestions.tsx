import { Type, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FontPairing {
  id: string;
  heading: string;
  body: string;
  label: string;
  vibe: string;
  sample_heading: string;
  sample_body: string;
}

const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'elegant',
    heading: 'Playfair Display',
    body: 'Lato',
    label: 'Elegant & Klassiek',
    vibe: 'Premium, luxe, tijdloos',
    sample_heading: 'Ontdek Onze Collectie',
    sample_body: 'Zorgvuldig geselecteerde producten met oog voor kwaliteit en stijl.',
  },
  {
    id: 'modern',
    heading: 'Space Grotesk',
    body: 'DM Sans',
    label: 'Modern & Tech',
    vibe: 'Innovatief, schoon, futuristisch',
    sample_heading: 'Next-Level Design',
    sample_body: 'De nieuwste trends in technologie en lifestyle, bij jou bezorgd.',
  },
  {
    id: 'friendly',
    heading: 'Poppins',
    body: 'Nunito',
    label: 'Vriendelijk & Toegankelijk',
    vibe: 'Warm, uitnodigend, speels',
    sample_heading: 'Welkom in Onze Shop!',
    sample_body: 'Van handgemaakte producten tot unieke vondsten — er is voor ieder wat wils.',
  },
  {
    id: 'editorial',
    heading: 'Merriweather',
    body: 'Source Sans Pro',
    label: 'Editorial & Storytelling',
    vibe: 'Betrouwbaar, inhoudelijk, autoritair',
    sample_heading: 'Het Verhaal Achter Elk Product',
    sample_body: 'Wij geloven in transparantie en duurzaamheid. Lees meer over onze missie.',
  },
  {
    id: 'bold',
    heading: 'Montserrat',
    body: 'Work Sans',
    label: 'Bold & Impactvol',
    vibe: 'Sterk, direct, energiek',
    sample_heading: 'MAAK EEN STATEMENT',
    sample_body: 'Producten die opvallen. Stijl die spreekt. Shop de collectie nu.',
  },
  {
    id: 'clean',
    heading: 'Inter',
    body: 'Inter',
    label: 'Ultra Clean',
    vibe: 'Minimalistisch, functioneel, professioneel',
    sample_heading: 'Eenvoud is de ultieme verfijning',
    sample_body: 'Minder ruis, meer focus. Producten die voor zichzelf spreken.',
  },
  {
    id: 'artisan',
    heading: 'Playfair Display',
    body: 'Raleway',
    label: 'Artisan & Ambacht',
    vibe: 'Handgemaakt, persoonlijk, authentiek',
    sample_heading: 'Met Liefde Gemaakt',
    sample_body: 'Elk product vertelt een verhaal van vakmanschap en passie.',
  },
  {
    id: 'geometric',
    heading: 'Raleway',
    body: 'Open Sans',
    label: 'Geometrisch & Chic',
    vibe: 'Fashionable, gestructureerd, verfijnd',
    sample_heading: 'Stijl Zonder Compromis',
    sample_body: 'Mode en lifestyle producten voor de moderne consument.',
  },
];

interface FontPairingSuggestionsProps {
  currentHeading: string;
  currentBody: string;
  onSelect: (heading: string, body: string) => void;
}

export function FontPairingSuggestions({ currentHeading, currentBody, onSelect }: FontPairingSuggestionsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          Font Pairing Suggesties
        </h3>
        <p className="text-xs text-muted-foreground">
          Bewezen combinaties die samen perfect werken — klik om toe te passen
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FONT_PAIRINGS.map((pairing) => {
          const isActive = currentHeading === pairing.heading && currentBody === pairing.body;
          return (
            <button
              key={pairing.id}
              onClick={() => onSelect(pairing.heading, pairing.body)}
              className={cn(
                'relative rounded-lg border-2 p-4 text-left transition-all hover:shadow-md',
                isActive
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {isActive && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div className="mb-2">
                <span className="text-[10px] font-medium text-muted-foreground">{pairing.label}</span>
                <span className="text-[9px] text-muted-foreground ml-2">— {pairing.vibe}</span>
              </div>
              <link
                href={`https://fonts.googleapis.com/css2?family=${pairing.heading.replace(' ', '+')}:wght@700&family=${pairing.body.replace(' ', '+')}:wght@400&display=swap`}
                rel="stylesheet"
              />
              <h4
                className="text-base font-bold mb-1 leading-tight"
                style={{ fontFamily: `"${pairing.heading}", serif` }}
              >
                {pairing.sample_heading}
              </h4>
              <p
                className="text-xs text-muted-foreground leading-relaxed"
                style={{ fontFamily: `"${pairing.body}", sans-serif` }}
              >
                {pairing.sample_body}
              </p>
              <div className="mt-2 flex gap-2 text-[9px] text-muted-foreground">
                <span className="bg-muted px-1.5 py-0.5 rounded">{pairing.heading}</span>
                <span className="text-muted-foreground">+</span>
                <span className="bg-muted px-1.5 py-0.5 rounded">{pairing.body}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
