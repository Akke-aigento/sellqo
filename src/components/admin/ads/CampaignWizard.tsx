import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useAdCampaigns } from '@/hooks/useAdCampaigns';
import { useAdPlatforms } from '@/hooks/useAdPlatforms';
import { AD_PLATFORMS, CAMPAIGN_TYPES, type AdPlatform, type CampaignType } from '@/types/ads';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';

interface CampaignWizardProps {
  onClose: () => void;
}

type WizardStep = 'platform' | 'type' | 'budget' | 'review';

export function CampaignWizard({ onClose }: CampaignWizardProps) {
  const { createCampaign } = useAdCampaigns();
  const { connectedPlatforms, isConnected } = useAdPlatforms();
  
  const [step, setStep] = useState<WizardStep>('platform');
  const [formData, setFormData] = useState({
    name: '',
    platform: '' as AdPlatform | '',
    campaign_type: '' as CampaignType | '',
    budget_type: 'daily' as 'daily' | 'lifetime',
    budget_amount: 25,
    target_roas: 4,
  });

  const steps: WizardStep[] = ['platform', 'type', 'budget', 'review'];
  const currentStepIndex = steps.indexOf(step);

  const canProceed = () => {
    switch (step) {
      case 'platform':
        return !!formData.platform;
      case 'type':
        return !!formData.campaign_type && !!formData.name;
      case 'budget':
        return formData.budget_amount > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    } else {
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!formData.platform || !formData.campaign_type) return;
    
    await createCampaign.mutateAsync({
      name: formData.name,
      platform: formData.platform,
      campaign_type: formData.campaign_type,
      budget_type: formData.budget_type,
      budget_amount: formData.budget_amount,
      target_roas: formData.target_roas,
    });
    
    onClose();
  };

  const availableCampaignTypes = formData.platform 
    ? Object.entries(CAMPAIGN_TYPES).filter(([_, info]) => 
        info.platforms.includes(formData.platform as AdPlatform)
      )
    : [];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i < currentStepIndex 
                ? 'bg-primary text-primary-foreground' 
                : i === currentStepIndex 
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {i < currentStepIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 ${
                i < currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        {step === 'platform' && (
          <>
            <CardHeader>
              <CardTitle>Kies Platform</CardTitle>
              <CardDescription>Op welk platform wil je adverteren?</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.platform}
                onValueChange={(v) => setFormData({ ...formData, platform: v as AdPlatform, campaign_type: '' })}
                className="grid gap-3"
              >
                {(Object.keys(AD_PLATFORMS) as AdPlatform[]).map(platform => {
                  const info = AD_PLATFORMS[platform];
                  const connected = isConnected(platform);
                  
                  return (
                    <Label
                      key={platform}
                      htmlFor={platform}
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        formData.platform === platform 
                          ? 'border-primary bg-primary/5' 
                          : connected 
                          ? 'hover:bg-muted/50' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <RadioGroupItem 
                        value={platform} 
                        id={platform} 
                        disabled={!connected}
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${info.color}`}>
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{info.name}</p>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                      {!connected && (
                        <span className="text-xs text-muted-foreground">Niet gekoppeld</span>
                      )}
                    </Label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </>
        )}

        {step === 'type' && (
          <>
            <CardHeader>
              <CardTitle>Campagne Details</CardTitle>
              <CardDescription>Geef je campagne een naam en kies het type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Campagnenaam</Label>
                <Input
                  id="name"
                  placeholder="bijv. Zomercollectie 2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Campagne Type</Label>
                <RadioGroup
                  value={formData.campaign_type}
                  onValueChange={(v) => setFormData({ ...formData, campaign_type: v as CampaignType })}
                  className="grid gap-2"
                >
                  {availableCampaignTypes.map(([type, info]) => (
                    <Label
                      key={type}
                      htmlFor={type}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.campaign_type === type ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={type} id={type} />
                      <div>
                        <p className="font-medium">{info.name}</p>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </>
        )}

        {step === 'budget' && (
          <>
            <CardHeader>
              <CardTitle>Budget & Biedingen</CardTitle>
              <CardDescription>Stel je budget en biedstrategie in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Budget Type</Label>
                <Select 
                  value={formData.budget_type}
                  onValueChange={(v) => setFormData({ ...formData, budget_type: v as 'daily' | 'lifetime' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Dagbudget</SelectItem>
                    <SelectItem value="lifetime">Totaalbudget</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Budget</Label>
                  <span className="text-lg font-semibold">€{formData.budget_amount}</span>
                </div>
                <Slider
                  value={[formData.budget_amount]}
                  onValueChange={([v]) => setFormData({ ...formData, budget_amount: v })}
                  min={5}
                  max={500}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  {formData.budget_type === 'daily' 
                    ? `Geschatte maandelijkse uitgaven: €${formData.budget_amount * 30}`
                    : 'Dit budget wordt over de hele looptijd verdeeld'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Doel ROAS</Label>
                  <span className="text-lg font-semibold">{formData.target_roas}x</span>
                </div>
                <Slider
                  value={[formData.target_roas]}
                  onValueChange={([v]) => setFormData({ ...formData, target_roas: v })}
                  min={1}
                  max={10}
                  step={0.5}
                />
                <p className="text-sm text-muted-foreground">
                  Voor elke €1 advertentie-uitgave verwacht je €{formData.target_roas} omzet
                </p>
              </div>
            </CardContent>
          </>
        )}

        {step === 'review' && (
          <>
            <CardHeader>
              <CardTitle>Controleer Campagne</CardTitle>
              <CardDescription>Bekijk je instellingen voordat je de campagne aanmaakt</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Platform</dt>
                  <dd className="font-medium">
                    {formData.platform && AD_PLATFORMS[formData.platform].name}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Naam</dt>
                  <dd className="font-medium">{formData.name}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">
                    {formData.campaign_type && CAMPAIGN_TYPES[formData.campaign_type].name}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Budget</dt>
                  <dd className="font-medium">
                    €{formData.budget_amount} {formData.budget_type === 'daily' ? '/dag' : 'totaal'}
                  </dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Doel ROAS</dt>
                  <dd className="font-medium">{formData.target_roas}x</dd>
                </div>
              </dl>
            </CardContent>
          </>
        )}

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStepIndex === 0 ? 'Annuleren' : 'Vorige'}
          </Button>
          
          {step === 'review' ? (
            <Button 
              onClick={handleSubmit}
              disabled={createCampaign.isPending}
            >
              {createCampaign.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aanmaken...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Campagne Aanmaken
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Volgende
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
