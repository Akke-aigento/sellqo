import { useState, useEffect } from 'react';
import { 
  Globe, 
  Link as LinkIcon, 
  Code, 
  ExternalLink, 
  Copy, 
  Check,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTenant } from '@/hooks/useTenant';
import { useStorefront } from '@/hooks/useStorefront';
import { toast } from 'sonner';

export function StorefrontSettings() {
  const { currentTenant } = useTenant();
  const { themeSettings, saveThemeSettings } = useStorefront();
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

  const domainVerified = currentTenant?.domain_verified;
  const customDomain = currentTenant?.custom_domain;
  const storefrontUrl = customDomain 
    ? `https://${customDomain}`
    : `${window.location.origin}/shop/${currentTenant?.slug}`;

  return (
    <div className="space-y-6">
      {/* Domain Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domeinen
          </CardTitle>
          <CardDescription>
            Beheer je gekoppelde domeinen en taalinstellingen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Domeinconfiguratie</p>
                <p className="text-sm text-muted-foreground">
                  Beheer je domeinen, talen en DNS-verificatie centraal bij Instellingen
                </p>
              </div>
            </div>
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
                  Bezoekers worden doorgestuurd naar deze URL
                </p>
              </div>

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
