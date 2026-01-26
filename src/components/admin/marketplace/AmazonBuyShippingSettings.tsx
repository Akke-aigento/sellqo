import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Truck, Info, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { MarketplaceSettings } from '@/types/marketplace';

interface AmazonBuyShippingSettingsProps {
  settings: MarketplaceSettings;
  onSettingsChange: (settings: Partial<MarketplaceSettings>) => void;
}

export function AmazonBuyShippingSettings({ settings, onSettingsChange }: AmazonBuyShippingSettingsProps) {
  const [enabled, setEnabled] = useState(settings.amazonBuyShippingEnabled || false);
  const [strategy, setStrategy] = useState<'cheapest' | 'fastest' | 'manual'>(
    settings.amazonShippingStrategy || 'cheapest'
  );

  const handleChange = (key: keyof MarketplaceSettings, value: unknown) => {
    onSettingsChange({ [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-orange-600" />
          <CardTitle className="text-lg">Amazon Buy Shipping</CardTitle>
        </div>
        <CardDescription>
          Genereer verzendlabels via Amazon voor lagere tarieven
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium">Amazon Buy Shipping inschakelen</Label>
            <p className="text-sm text-muted-foreground">
              Gebruik Amazon's verzendservice voor MFN orders
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              handleChange('amazonBuyShippingEnabled', checked);
            }}
          />
        </div>

        {enabled && (
          <>
            <div className="space-y-3">
              <Label>Selectie strategie</Label>
              <RadioGroup
                value={strategy}
                onValueChange={(value: 'cheapest' | 'fastest' | 'manual') => {
                  setStrategy(value);
                  handleChange('amazonShippingStrategy', value);
                }}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cheapest" id="cheapest" />
                  <Label htmlFor="cheapest" className="font-normal cursor-pointer">
                    Goedkoopste optie (aanbevolen)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fastest" id="fastest" />
                  <Label htmlFor="fastest" className="font-normal cursor-pointer">
                    Snelste optie
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal cursor-pointer">
                    Handmatige selectie
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4" />
                  <strong>Let op:</strong>
                </div>
                Amazon Buy Shipping werkt alleen voor MFN orders (zelf verzenden). 
                FBA orders worden door Amazon afgehandeld en hebben geen aparte labels nodig.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
