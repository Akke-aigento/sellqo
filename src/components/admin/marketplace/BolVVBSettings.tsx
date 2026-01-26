import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Truck, Package, AlertCircle, Info, Euro } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { MarketplaceSettings } from '@/types/marketplace';

interface BolVVBSettingsProps {
  settings: MarketplaceSettings;
  onSettingsChange: (settings: Partial<MarketplaceSettings>) => void;
}

export function BolVVBSettings({ settings, onSettingsChange }: BolVVBSettingsProps) {
  const [vvbEnabled, setVvbEnabled] = useState(settings.vvbEnabled || false);
  const [vvbMaxAmount, setVvbMaxAmount] = useState(settings.vvbMaxAmount?.toString() || '300');
  const [vvbFallbackProvider, setVvbFallbackProvider] = useState<'sendcloud' | 'myparcel'>(
    settings.vvbFallbackProvider || 'sendcloud'
  );
  const [vvbDefaultCarrier, setVvbDefaultCarrier] = useState(settings.vvbDefaultCarrier || 'POSTNL');
  const [autoConfirmShipment, setAutoConfirmShipment] = useState(settings.autoConfirmShipment || false);

  // Sync local state with props
  useEffect(() => {
    setVvbEnabled(settings.vvbEnabled || false);
    setVvbMaxAmount(settings.vvbMaxAmount?.toString() || '300');
    setVvbFallbackProvider(settings.vvbFallbackProvider || 'sendcloud');
    setVvbDefaultCarrier(settings.vvbDefaultCarrier || 'POSTNL');
    setAutoConfirmShipment(settings.autoConfirmShipment || false);
  }, [settings]);

  const handleChange = (key: keyof MarketplaceSettings, value: unknown) => {
    onSettingsChange({ [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* VVB Labels Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Verzenden via Bol (VVB)</CardTitle>
          </div>
          <CardDescription>
            Genereer paklabels direct via Bol.com voor lagere verzendkosten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">VVB labels inschakelen</Label>
              <p className="text-sm text-muted-foreground">
                Gebruik Bol.com VVB labels voor goedkopere verzending
              </p>
            </div>
            <Switch
              checked={vvbEnabled}
              onCheckedChange={(checked) => {
                setVvbEnabled(checked);
                handleChange('vvbEnabled', checked);
              }}
            />
          </div>

          {vvbEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="vvb-max-amount" className="flex items-center gap-2">
                  <Euro className="w-4 h-4" />
                  Maximum orderbedrag voor VVB
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">€</span>
                  <Input
                    id="vvb-max-amount"
                    type="number"
                    min="0"
                    step="10"
                    value={vvbMaxAmount}
                    onChange={(e) => {
                      setVvbMaxAmount(e.target.value);
                      handleChange('vvbMaxAmount', parseFloat(e.target.value) || 0);
                    }}
                    className="w-32"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Orders boven dit bedrag worden via je standaard verzendprovider verzonden
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Voorbeeld:</strong> Bij €{vvbMaxAmount || 300} max bedrag:
                  <ul className="list-disc list-inside mt-1 text-sm">
                    <li>Order €150 → VVB label (goedkoper, geen verzekering)</li>
                    <li>Order €400 → {vvbFallbackProvider === 'sendcloud' ? 'Sendcloud' : 'MyParcel'} label (verzekerd)</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Fallback verzendprovider</Label>
                <Select
                  value={vvbFallbackProvider}
                  onValueChange={(value: 'sendcloud' | 'myparcel') => {
                    setVvbFallbackProvider(value);
                    handleChange('vvbFallbackProvider', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kies provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sendcloud">Sendcloud</SelectItem>
                    <SelectItem value="myparcel">MyParcel</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Wordt gebruikt voor orders boven €{vvbMaxAmount || 300} voor verzekering
                </p>
              </div>

              <div className="space-y-2">
                <Label>Standaard carrier voor VVB</Label>
                <Select
                  value={vvbDefaultCarrier}
                  onValueChange={(value) => {
                    setVvbDefaultCarrier(value);
                    handleChange('vvbDefaultCarrier', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kies carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POSTNL">PostNL</SelectItem>
                    <SelectItem value="DHL">DHL</SelectItem>
                    <SelectItem value="DPD-NL">DPD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Auto Confirm Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">Automatische Verzendbevestiging</CardTitle>
          </div>
          <CardDescription>
            Stuur track & trace automatisch naar Bol.com wanneer een label wordt aangemaakt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Auto verzendbevestiging</Label>
              <p className="text-sm text-muted-foreground">
                Bij het aanmaken van een label wordt de verzending automatisch bevestigd naar Bol.com
              </p>
            </div>
            <Switch
              checked={autoConfirmShipment}
              onCheckedChange={(checked) => {
                setAutoConfirmShipment(checked);
                handleChange('autoConfirmShipment', checked);
              }}
            />
          </div>

          {autoConfirmShipment && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Wanneer je een verzendlabel aanmaakt (via Sendcloud, MyParcel of VVB), 
                wordt het track & trace nummer automatisch naar Bol.com gestuurd en de 
                order als &quot;verzonden&quot; gemarkeerd.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
