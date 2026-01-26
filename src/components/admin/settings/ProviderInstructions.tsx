import { ExternalLink, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ProviderInstructionsProps {
  provider: string;
  domain: string;
}

interface ProviderGuide {
  name: string;
  url: string;
  steps: string[];
  tips?: string[];
}

const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  transip: {
    name: 'TransIP',
    url: 'https://my.transip.nl',
    steps: [
      'Log in op my.transip.nl',
      'Ga naar "Domeinen" in het hoofdmenu',
      'Klik op je domeinnaam',
      'Selecteer "DNS" in het submenu',
      'Klik op "Nieuw record toevoegen"',
      'Voer de A-record in: Type "A", Naam "@", Waarde "185.158.133.1"',
      'Voer nog een A-record in: Type "A", Naam "www", Waarde "185.158.133.1"',
      'Voer het TXT-record in met de verificatiecode',
      'Klik op "Opslaan"',
    ],
    tips: [
      'DNS wijzigingen kunnen 15-60 minuten duren bij TransIP',
      'Verwijder eventuele bestaande A-records voor @ en www eerst',
    ],
  },
  combell: {
    name: 'Combell',
    url: 'https://my.combell.com',
    steps: [
      'Log in op my.combell.com',
      'Ga naar "Domeinen" → "DNS-beheer"',
      'Selecteer je domein',
      'Klik op "DNS-record toevoegen"',
      'Voeg een A-record toe voor "@" met IP "185.158.133.1"',
      'Voeg een A-record toe voor "www" met IP "185.158.133.1"',
      'Voeg een TXT-record toe voor "_sellqo" met de verificatiecode',
      'Sla de wijzigingen op',
    ],
    tips: [
      'DNS propagatie bij Combell duurt meestal 30 minuten tot 2 uur',
    ],
  },
  'one.com': {
    name: 'one.com',
    url: 'https://www.one.com/admin',
    steps: [
      'Log in op je one.com controlepaneel',
      'Klik op "DNS-instellingen"',
      'Selecteer je domein',
      'Zoek de sectie "DNS-records"',
      'Voeg een A-record toe: Host "@", Wijst naar "185.158.133.1"',
      'Voeg een A-record toe: Host "www", Wijst naar "185.158.133.1"',
      'Voeg een TXT-record toe voor verificatie',
      'Klik op "Opslaan"',
    ],
    tips: [
      'one.com kan tot 24 uur nodig hebben voor DNS propagatie',
    ],
  },
  hostinger: {
    name: 'Hostinger',
    url: 'https://hpanel.hostinger.com',
    steps: [
      'Log in op hpanel.hostinger.com',
      'Ga naar "Domeinen" in de zijbalk',
      'Klik op je domein',
      'Selecteer "DNS / Nameservers"',
      'Scroll naar "DNS Records"',
      'Klik op "Add Record" en kies "A"',
      'Naam: "@", IP: "185.158.133.1", TTL: Auto',
      'Herhaal voor "www"',
      'Voeg TXT-record toe voor verificatie',
    ],
    tips: [
      'Hostinger DNS updates zijn meestal binnen 15 minuten actief',
      'Controleer of je geen conflicterende CNAME records hebt',
    ],
  },
  versio: {
    name: 'Versio',
    url: 'https://www.versio.nl/customer',
    steps: [
      'Log in op versio.nl/customer',
      'Ga naar "Mijn Domeinen"',
      'Klik op het tandwiel icoon naast je domein',
      'Selecteer "DNS beheren"',
      'Voeg A-records toe voor @ en www',
      'Voeg het TXT-record toe',
      'Sla op',
    ],
  },
  neostrada: {
    name: 'Neostrada',
    url: 'https://my.neostrada.nl',
    steps: [
      'Log in op my.neostrada.nl',
      'Ga naar "Domeinen"',
      'Selecteer je domein en klik op "Beheer"',
      'Klik op "DNS beheer"',
      'Voeg de vereiste A-records toe',
      'Voeg het TXT-verificatierecord toe',
      'Sla de wijzigingen op',
    ],
  },
  mijndomein: {
    name: 'Mijn Domein',
    url: 'https://www.mijndomein.nl/mijn-account',
    steps: [
      'Log in op mijndomein.nl',
      'Ga naar "Mijn Domeinen"',
      'Selecteer je domein',
      'Klik op "DNS Instellingen"',
      'Voeg A-records toe voor root en www',
      'Voeg TXT-record toe voor verificatie',
      'Bevestig de wijzigingen',
    ],
  },
  antagonist: {
    name: 'Antagonist',
    url: 'https://my.antagonist.nl',
    steps: [
      'Log in op my.antagonist.nl',
      'Ga naar "Domeinen" → "DNS-zones"',
      'Selecteer je domein',
      'Voeg de DNS records toe',
      'Sla op',
    ],
  },
  namecheap: {
    name: 'Namecheap',
    url: 'https://www.namecheap.com/myaccount',
    steps: [
      'Log in op namecheap.com',
      'Ga naar "Domain List"',
      'Klik op "Manage" naast je domein',
      'Selecteer "Advanced DNS"',
      'Voeg A Records toe voor @ en www',
      'Voeg TXT Record toe voor verificatie',
      'Sla de wijzigingen op',
    ],
  },
  godaddy: {
    name: 'GoDaddy',
    url: 'https://dcc.godaddy.com/manage',
    steps: [
      'Log in op godaddy.com',
      'Ga naar "My Products" → "Domains"',
      'Klik op je domein',
      'Selecteer "DNS"',
      'Voeg A-records toe voor @ en www met IP 185.158.133.1',
      'Voeg TXT-record toe voor _sellqo met verificatiecode',
      'Klik op "Save"',
    ],
  },
  ovh: {
    name: 'OVH',
    url: 'https://www.ovh.com/manager',
    steps: [
      'Log in op OVH Manager',
      'Ga naar "Domeinen"',
      'Selecteer je domein',
      'Klik op "DNS Zone"',
      'Voeg de records toe via "Add an entry"',
      'Kies type A en vul de gegevens in',
      'Bevestig elke wijziging',
    ],
  },
  strato: {
    name: 'Strato',
    url: 'https://www.strato.nl/apps/CustomerService',
    steps: [
      'Log in op je Strato account',
      'Ga naar "Domeinen" → "Domeinbeheer"',
      'Selecteer je domein',
      'Klik op "DNS beheren"',
      'Voeg de A-records en TXT-record toe',
      'Sla de wijzigingen op',
    ],
  },
};

export function ProviderInstructions({ provider, domain }: ProviderInstructionsProps) {
  const guide = PROVIDER_GUIDES[provider];

  if (!guide) {
    return null;
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="instructions" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>Stap-voor-stap instructies voor {guide.name}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Steps */}
            <ol className="space-y-2 text-sm">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            {/* Tips */}
            {guide.tips && guide.tips.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-foreground">Tips:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {guide.tips.map((tip, index) => (
                    <li key={index}>• {tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Link to Provider */}
            <Button variant="outline" size="sm" asChild>
              <a href={guide.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open {guide.name}
              </a>
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
