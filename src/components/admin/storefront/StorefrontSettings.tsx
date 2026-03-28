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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { useTenantDomains } from '@/hooks/useTenantDomains';
import { toast } from 'sonner';

export function StorefrontSettings() {
  const { currentTenant } = useTenant();
  const { themeSettings, saveThemeSettings } = useStorefront();
  const { domains, canonicalDomain } = useTenantDomains();
  const [copied, setCopied] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    use_custom_frontend: false,
    custom_frontend_url: '',
    custom_head_scripts: '',
  });

  useEffect(() => {
    if (themeSettings) {
      setFormData({
        use_custom_frontend: themeSettings.use_custom_frontend,
        custom_frontend_url: themeSettings.custom_frontend_url || '',
        custom_head_scripts: themeSettings.custom_head_scripts || '',
      });
    }
  }, [themeSettings]);

  const handleSave = () => {
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

  return (
    <div className="space-y-6">
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

          {/* Additional domains info */}
          {activeDomains.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {verifiedDomains.length} van {activeDomains.length} domeinen geverifieerd
              {formData.use_custom_frontend && ' — alle domeinen serveren je custom frontend'}
            </p>
          )}

          {/* SellQo fallback URL if custom domains exist */}
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

          {formData.use_custom_frontend && (
            <div className="space-y-4 pl-4 border-l-2">
              <div className="space-y-2">
                <Label>Custom Frontend URL</Label>
                <Input
                  value={formData.custom_frontend_url}
                  onChange={(e) => setFormData({ ...formData, custom_frontend_url: e.target.value })}
                  placeholder="https://mijn-custom-shop.lovable.app"
                />
                <p className="text-xs text-muted-foreground">
                  Je domeinen serveren deze URL — klanten zien alleen hun eigen domein
                </p>
              </div>

              {/* Hint: no domains configured */}
              {activeDomains.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Koppel een eigen domein</AlertTitle>
                  <AlertDescription>
                    Zonder eigen domein zien klanten de technische URL. Koppel een domein zodat klanten altijd je eigen domeinnaam zien.
                    <Button variant="link" size="sm" className="px-0 ml-1" asChild>
                      <a href="/admin/settings?tab=domains">Domein toevoegen →</a>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Show which domains serve the custom frontend */}
              {verifiedDomains.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Domeinen die je custom frontend serveren:</Label>
                  <div className="flex flex-wrap gap-2">
                    {verifiedDomains.map(d => (
                      <Badge key={d.id} variant="secondary" className="text-xs">
                        {d.domain}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Alert>
                <Code className="h-4 w-4" />
                <AlertTitle>API Toegang</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Je custom frontend kan data ophalen via de SellQo API:</p>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-2 py-1 rounded truncate">
                        {`${window.location.origin}/api/storefront`}
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(`${window.location.origin}/api/storefront`, 'api')}
                      >
                        {copied === 'api' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gebruik de <code className="bg-muted px-1 rounded">resolve_domain</code> actie om automatisch de tenant en locale te detecteren op basis van het domein.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Tenant ID:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {currentTenant?.id}
                      </code>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(currentTenant?.id || '', 'tenant')}
                      >
                        {copied === 'tenant' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

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
