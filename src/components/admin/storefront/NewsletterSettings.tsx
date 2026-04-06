import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Mail, Users, AlertCircle, ExternalLink } from 'lucide-react';
import { useNewsletterConfig, useNewsletterSubscribers } from '@/hooks/useNewsletterConfig';
import { toast } from 'sonner';
import { CampaignRichEditor } from '@/components/admin/marketing/CampaignRichEditor';

export function NewsletterSettings() {
  const { config, isLoading, saveConfig, testConnection } = useNewsletterConfig();
  const { stats } = useNewsletterSubscribers();
  
  const [formData, setFormData] = useState({
    provider: 'internal' as 'internal' | 'mailchimp' | 'klaviyo',
    mailchimp_api_key: '',
    mailchimp_server_prefix: '',
    mailchimp_audience_id: '',
    klaviyo_api_key: '',
    klaviyo_list_id: '',
    double_optin: false,
    welcome_email_enabled: true,
    welcome_email_subject: 'Welkom bij onze nieuwsbrief!',
    welcome_email_body: '',
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    details?: any;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        provider: config.provider || 'internal',
        mailchimp_api_key: config.mailchimp_api_key || '',
        mailchimp_server_prefix: config.mailchimp_server_prefix || '',
        mailchimp_audience_id: config.mailchimp_audience_id || '',
        klaviyo_api_key: config.klaviyo_api_key || '',
        klaviyo_list_id: config.klaviyo_list_id || '',
        double_optin: config.double_optin || false,
        welcome_email_enabled: config.welcome_email_enabled ?? true,
        welcome_email_subject: config.welcome_email_subject || 'Welkom bij onze nieuwsbrief!',
        welcome_email_body: config.welcome_email_body || '',
      });
    }
  }, [config]);

  const handleTestConnection = async () => {
    setTestResult(null);
    
    try {
      let testConfig: any = { provider: formData.provider };
      
      if (formData.provider === 'mailchimp') {
        if (!formData.mailchimp_api_key) {
          toast.error('Vul eerst je Mailchimp API key in');
          return;
        }
        testConfig = {
          ...testConfig,
          apiKey: formData.mailchimp_api_key,
          serverPrefix: formData.mailchimp_server_prefix,
          audienceId: formData.mailchimp_audience_id,
        };
      } else if (formData.provider === 'klaviyo') {
        if (!formData.klaviyo_api_key) {
          toast.error('Vul eerst je Klaviyo API key in');
          return;
        }
        testConfig = {
          ...testConfig,
          apiKey: formData.klaviyo_api_key,
          listId: formData.klaviyo_list_id,
        };
      }

      const result = await testConnection.mutateAsync(testConfig);
      setTestResult(result);
      
      if (result.success) {
        toast.success('Verbinding succesvol!');
      } else {
        toast.error(result.error || 'Verbinding mislukt');
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
      toast.error('Fout bij testen verbinding');
    }
  };

  const handleSave = () => {
    saveConfig.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            <p className="text-sm text-muted-foreground">Totaal subscribers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{stats.active}</span>
            </div>
            <p className="text-sm text-muted-foreground">Actief</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{stats.synced}</span>
            </div>
            <p className="text-sm text-muted-foreground">Gesynchroniseerd</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-2xl font-bold">{stats.failed}</span>
            </div>
            <p className="text-sm text-muted-foreground">Sync mislukt</p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Nieuwsbrief Provider</CardTitle>
          <CardDescription>
            Kies waar je nieuwsbrief subscribers naartoe worden gestuurd
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={formData.provider}
              onValueChange={(value: 'internal' | 'mailchimp' | 'klaviyo') => {
                setFormData(prev => ({ ...prev, provider: value }));
                setTestResult(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Intern (gebruik voor eigen campagnes)
                  </div>
                </SelectItem>
                <SelectItem value="mailchimp">
                  <div className="flex items-center gap-2">
                    <img src="https://cdn.worldvectorlogo.com/logos/mailchimp-freddie-icon.svg" alt="Mailchimp" className="h-4 w-4" />
                    Mailchimp
                  </div>
                </SelectItem>
                <SelectItem value="klaviyo">
                  <div className="flex items-center gap-2">
                    <img src="https://www.klaviyo.com/wp-content/uploads/2023/06/favicon.svg" alt="Klaviyo" className="h-4 w-4" />
                    Klaviyo
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.provider === 'internal' && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Subscribers worden opgeslagen in je database en kunnen gebruikt worden voor je eigen email campagnes via het Marketing menu.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mailchimp Config */}
      {formData.provider === 'mailchimp' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <img src="https://cdn.worldvectorlogo.com/logos/mailchimp-freddie-icon.svg" alt="Mailchimp" className="h-5 w-5" />
                  Mailchimp Configuratie
                </CardTitle>
                <CardDescription>
                  Verbind met je Mailchimp account
                </CardDescription>
              </div>
              <a 
                href="https://mailchimp.com/developer/marketing/guides/quick-start/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Documentatie
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mailchimp_api_key">API Key *</Label>
              <Input
                id="mailchimp_api_key"
                type="password"
                value={formData.mailchimp_api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, mailchimp_api_key: e.target.value }))}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21"
              />
              <p className="text-xs text-muted-foreground">
                Vind je API key in Mailchimp → Account → Extras → API Keys
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mailchimp_server_prefix">Server Prefix</Label>
              <Input
                id="mailchimp_server_prefix"
                value={formData.mailchimp_server_prefix}
                onChange={(e) => setFormData(prev => ({ ...prev, mailchimp_server_prefix: e.target.value }))}
                placeholder="us21"
              />
              <p className="text-xs text-muted-foreground">
                Het gedeelte na het streepje in je API key (bijv. us21). Wordt automatisch gedetecteerd als je het leeg laat.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mailchimp_audience_id">Audience/List ID *</Label>
              <Input
                id="mailchimp_audience_id"
                value={formData.mailchimp_audience_id}
                onChange={(e) => setFormData(prev => ({ ...prev, mailchimp_audience_id: e.target.value }))}
                placeholder="abc123def4"
              />
              <p className="text-xs text-muted-foreground">
                Vind je Audience ID in Mailchimp → Audience → Settings → Audience name and defaults
              </p>
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                    {testResult.success ? 'Verbinding succesvol!' : testResult.error}
                  </span>
                </div>
                {testResult.details && testResult.success && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>Account: {testResult.details.accountName}</p>
                    {testResult.details.audienceInfo && (
                      <p>Audience: {testResult.details.audienceInfo.name} ({testResult.details.audienceInfo.memberCount} members)</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Verbinding
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Klaviyo Config */}
      {formData.provider === 'klaviyo' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <img src="https://www.klaviyo.com/wp-content/uploads/2023/06/favicon.svg" alt="Klaviyo" className="h-5 w-5" />
                  Klaviyo Configuratie
                </CardTitle>
                <CardDescription>
                  Verbind met je Klaviyo account
                </CardDescription>
              </div>
              <a 
                href="https://developers.klaviyo.com/en/docs/getting-started" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Documentatie
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="klaviyo_api_key">Private API Key *</Label>
              <Input
                id="klaviyo_api_key"
                type="password"
                value={formData.klaviyo_api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, klaviyo_api_key: e.target.value }))}
                placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Vind je Private API key in Klaviyo → Settings → Account → API Keys
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="klaviyo_list_id">List ID *</Label>
              <Input
                id="klaviyo_list_id"
                value={formData.klaviyo_list_id}
                onChange={(e) => setFormData(prev => ({ ...prev, klaviyo_list_id: e.target.value }))}
                placeholder="XxXxXx"
              />
              <p className="text-xs text-muted-foreground">
                Vind je List ID in Klaviyo → Audience → Lists & Segments → Klik op je list → Settings
              </p>
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                    {testResult.success ? 'Verbinding succesvol!' : testResult.error}
                  </span>
                </div>
                {testResult.details && testResult.success && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>Account: {testResult.details.accountName}</p>
                    {testResult.details.listInfo && (
                      <p>List: {testResult.details.listInfo.name}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Verbinding
            </Button>
          </CardContent>
        </Card>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Algemene Instellingen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Double Opt-in</Label>
              <p className="text-sm text-muted-foreground">
                Vereist bevestiging via email voordat iemand is aangemeld
              </p>
            </div>
            <Switch
              checked={formData.double_optin}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, double_optin: checked }))}
            />
          </div>

          {formData.provider === 'internal' && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Welkomst Email</Label>
                <p className="text-sm text-muted-foreground">
                  Stuur automatisch een welkomst email naar nieuwe subscribers
                </p>
              </div>
              <Switch
                checked={formData.welcome_email_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, welcome_email_enabled: checked }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveConfig.isPending}>
          {saveConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Opslaan
        </Button>
      </div>
    </div>
  );
}
