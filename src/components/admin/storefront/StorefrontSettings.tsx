import { useState, useEffect } from 'react';
import { 
  Globe, 
  Link as LinkIcon, 
  Code, 
  ExternalLink, 
  Copy, 
  Check,
  AlertCircle,
  Info,
  Eye,
  Lock,
  EyeOff,
} from 'lucide-react';
import { CustomFrontendConfigPanel } from './CustomFrontendConfigPanel';
import { CustomFrontendConfig, DEFAULT_CUSTOM_FRONTEND_CONFIG } from '@/types/custom-frontend-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', description: 'Publiek toegankelijk voor iedereen', icon: Eye, color: 'text-green-600' },
  { value: 'password', label: 'Wachtwoord', description: 'Bezoekers moeten een wachtwoord invoeren', icon: Lock, color: 'text-amber-600' },
  { value: 'offline', label: 'Offline', description: 'Webshop is niet bereikbaar', icon: EyeOff, color: 'text-destructive' },
] as const;

export function StorefrontSettings() {
  const { currentTenant } = useTenant();
  const { themeSettings, saveThemeSettings } = useStorefront();
  const { domains, canonicalDomain } = useTenantDomains();
  const [copied, setCopied] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    use_custom_frontend: false,
    custom_frontend_url: '',
    custom_head_scripts: '',
    storefront_status: 'online' as string,
    storefront_password: '',
    custom_frontend_config: DEFAULT_CUSTOM_FRONTEND_CONFIG as CustomFrontendConfig,
  });

  useEffect(() => {
    if (themeSettings) {
      const ts = themeSettings as any;
      setFormData({
        use_custom_frontend: themeSettings.use_custom_frontend,
        custom_frontend_url: themeSettings.custom_frontend_url || '',
        custom_head_scripts: themeSettings.custom_head_scripts || '',
        storefront_status: ts.storefront_status || 'online',
        storefront_password: ts.storefront_password || '',
        custom_frontend_config: ts.custom_frontend_config 
          ? { ...DEFAULT_CUSTOM_FRONTEND_CONFIG, ...ts.custom_frontend_config }
          : DEFAULT_CUSTOM_FRONTEND_CONFIG,
      });
    }
  }, [themeSettings]);

  const handleSave = () => {
    if (formData.storefront_status === 'password' && !formData.storefront_password.trim()) {
      toast.error('Voer een wachtwoord in voor de wachtwoord-modus');
      return;
    }
    saveThemeSettings.mutate(formData);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Gekopieerd naar klembord');
    setTimeout(() => setCopied(null), 2000);
  };

  const activeDomains = domains.filter(d => d.is_active);
  const verifiedDomains = activeDomains.filter(d => d.dns_verified);
  const primaryUrl = canonicalDomain?.domain
    ? `https://${canonicalDomain.domain}`
    : `/shop/${currentTenant?.slug}`;

  const currentStatusOption = STATUS_OPTIONS.find(o => o.value === formData.storefront_status) || STATUS_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Storefront Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <currentStatusOption.icon className={cn("h-5 w-5", currentStatusOption.color)} />
            Webshop Status
          </CardTitle>
          <CardDescription>
            Bepaal wie toegang heeft tot je webshop
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={formData.storefront_status}
            onValueChange={(value) => setFormData({ ...formData, storefront_status: value })}
            className="grid gap-3"
          >
            {STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                  formData.storefront_status === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value={option.value} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <option.icon className={cn("h-4 w-4", option.color)} />
                    <span className="font-medium text-sm">{option.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          {formData.storefront_status === 'password' && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/50">
              <Label>Wachtwoord</Label>
              <Input
                type="text"
                value={formData.storefront_password}
                onChange={(e) => setFormData({ ...formData, storefront_password: e.target.value })}
                placeholder="Voer een wachtwoord in"
              />
              <p className="text-xs text-muted-foreground">
                Bezoekers moeten dit wachtwoord invoeren om de webshop te bekijken
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domeinen & URL
          </CardTitle>
          <CardDescription>
            Je webshop is bereikbaar via de volgende URL's
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary URL */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-primary" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{primaryUrl}</span>
                  {canonicalDomain && <Badge variant="default" className="text-xs">Primair</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.use_custom_frontend 
                    ? 'Serveert je custom frontend'
                    : 'Serveert het SellQo theme'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(primaryUrl, 'primary-url')}>
              {copied === 'primary-url' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>

          {activeDomains.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {verifiedDomains.length} van {activeDomains.length} domeinen geverifieerd
              {formData.use_custom_frontend && ' — alle domeinen serveren je custom frontend'}
            </p>
          )}

          {canonicalDomain && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Technische URL:</span>
              <code className="bg-muted px-1.5 py-0.5 rounded">/shop/{currentTenant?.slug}</code>
              <span>(redirect naar primair domein)</span>
            </div>
          )}

          <div className="pt-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/settings?tab=domains">
                <ExternalLink className="h-4 w-4 mr-2" />
                Domeinen beheren
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Frontend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Custom Frontend
          </CardTitle>
          <CardDescription>
            Gebruik een extern gebouwde frontend in plaats van de standaard themes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Gebruik Custom Frontend</Label>
              <p className="text-sm text-muted-foreground">
                Schakel in als je een aparte Lovable of externe frontend hebt
              </p>
            </div>
            <Switch
              checked={formData.use_custom_frontend}
              onCheckedChange={(checked) => setFormData({ ...formData, use_custom_frontend: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Frontend Configuration Panel */}
      {formData.use_custom_frontend && (
        <CustomFrontendConfigPanel
          config={formData.custom_frontend_config}
          onChange={(newConfig) => setFormData({ ...formData, custom_frontend_config: newConfig })}
        />
      )}

      {/* Tracking & Scripts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Tracking & Scripts
          </CardTitle>
          <CardDescription>
            Voeg Google Analytics, Facebook Pixel of andere scripts toe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Custom Head Scripts</Label>
            <Textarea
              value={formData.custom_head_scripts}
              onChange={(e) => setFormData({ ...formData, custom_head_scripts: e.target.value })}
              rows={8}
              placeholder={`<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>`}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Deze scripts worden in de &lt;head&gt; sectie van je webshop geladen
            </p>
          </div>

          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Let op</AlertTitle>
            <AlertDescription>
              Voeg alleen scripts toe van vertrouwde bronnen. Onjuiste scripts kunnen je webshop breken 
              of beveiligingsrisico's veroorzaken.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveThemeSettings.isPending}>
          Instellingen Opslaan
        </Button>
      </div>
    </div>
  );
}
