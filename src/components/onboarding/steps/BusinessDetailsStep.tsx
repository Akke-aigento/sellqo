import { Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OnboardingTooltip, OnboardingInfoPopover } from '../OnboardingTooltip';
import { OnboardingData } from '@/hooks/useOnboarding';

interface BusinessDetailsStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const EU_COUNTRIES = [
  { code: 'NL', name: 'Nederland' },
  { code: 'BE', name: 'België' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'AT', name: 'Oostenrijk' },
  { code: 'ES', name: 'Spanje' },
  { code: 'IT', name: 'Italië' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ierland' },
  { code: 'PL', name: 'Polen' },
  { code: 'CZ', name: 'Tsjechië' },
  { code: 'DK', name: 'Denemarken' },
  { code: 'SE', name: 'Zweden' },
  { code: 'FI', name: 'Finland' },
  { code: 'GR', name: 'Griekenland' },
];

export function BusinessDetailsStep({
  data,
  updateData,
  onNext,
  onPrev,
}: BusinessDetailsStepProps) {
  const canContinue = 
    data.businessName.trim().length >= 2 &&
    data.email.trim().length >= 5 &&
    data.address.trim().length >= 5 &&
    data.postalCode.trim().length >= 4 &&
    data.city.trim().length >= 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canContinue) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Bedrijfsgegevens</h2>
        <p className="text-muted-foreground">
          Deze gegevens verschijnen op je facturen en zijn verplicht voor EU-wetgeving.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="businessName">Bedrijfsnaam / Eigenaar *</Label>
              <OnboardingTooltip
                title="Bedrijfsnaam"
                content="Vul je officiële bedrijfsnaam in, of je eigen naam als je als particulier verkoopt."
              />
            </div>
            <Input
              id="businessName"
              value={data.businessName}
              onChange={(e) => updateData({ businessName: e.target.value })}
              placeholder="Jouw Bedrijf B.V."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="email">E-mailadres *</Label>
              <OnboardingTooltip
                title="E-mailadres"
                content="Dit e-mailadres wordt gebruikt voor bestellingen, facturen en klantcommunicatie."
              />
            </div>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => updateData({ email: e.target.value })}
              placeholder="info@jouwbedrijf.nl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="address">Adres *</Label>
            <OnboardingTooltip
              title="Adres"
              content="Je vestigingsadres is verplicht op facturen volgens EU-regelgeving."
            />
          </div>
          <Input
            id="address"
            value={data.address}
            onChange={(e) => updateData({ address: e.target.value })}
            placeholder="Straatnaam 123"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postcode *</Label>
            <Input
              id="postalCode"
              value={data.postalCode}
              onChange={(e) => updateData({ postalCode: e.target.value })}
              placeholder="1234 AB"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Plaats *</Label>
            <Input
              id="city"
              value={data.city}
              onChange={(e) => updateData({ city: e.target.value })}
              placeholder="Amsterdam"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Land *</Label>
            <Select
              value={data.country}
              onValueChange={(value) => updateData({ country: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer land" />
              </SelectTrigger>
              <SelectContent>
                {EU_COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="vatNumber">BTW-nummer</Label>
              <OnboardingInfoPopover title="BTW-nummer">
                <div className="space-y-2">
                  <p>Je BTW-nummer vind je op:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Je KvK-uittreksel</li>
                    <li>Je belastingaangifte</li>
                    <li>Mijn Belastingdienst portaal</li>
                  </ul>
                  <p className="pt-2">
                    <strong>Formaat:</strong> NL + 9 cijfers + B + 2 cijfers
                    <br />
                    <strong>Voorbeeld:</strong> NL123456789B01
                  </p>
                  <p className="pt-2 text-xs">
                    Nog geen BTW-nummer? Geen probleem! Je kunt dit later toevoegen.
                  </p>
                </div>
              </OnboardingInfoPopover>
            </div>
            <Input
              id="vatNumber"
              value={data.vatNumber}
              onChange={(e) => updateData({ vatNumber: e.target.value.toUpperCase() })}
              placeholder="NL123456789B01 (optioneel)"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="chamberOfCommerce">KvK / KBO-nummer</Label>
              <OnboardingTooltip
                title="KvK / KBO-nummer"
                content="Je Kamer van Koophandel (NL) of Kruispuntbank (BE) nummer. Optioneel voor starters."
              />
            </div>
            <Input
              id="chamberOfCommerce"
              value={data.chamberOfCommerce}
              onChange={(e) => updateData({ chamberOfCommerce: e.target.value })}
              placeholder="12345678 (optioneel)"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vorige
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!canContinue}
        >
          Volgende stap
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
