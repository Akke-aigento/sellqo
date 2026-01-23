import { useState } from 'react';
import { Monitor, Smartphone, Tablet, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface EmailPreviewProps {
  htmlContent: string;
  subject: string;
  showTestDialog?: boolean;
  onTestDialogChange?: (open: boolean) => void;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceWidths: Record<DeviceType, number> = {
  desktop: 600,
  tablet: 480,
  mobile: 320,
};

export function EmailPreview({ htmlContent, subject, showTestDialog, onTestDialogChange }: EmailPreviewProps) {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('Test Klant');
  const [sending, setSending] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const { currentTenant } = useTenant();

  const dialogOpen = showTestDialog ?? testDialogOpen;
  const setDialogOpen = onTestDialogChange ?? setTestDialogOpen;

  // Replace template variables for preview
  const tenantData = currentTenant as { name?: string; street?: string; postal_code?: string; city?: string } | null;
  const previewHtml = htmlContent
    .replace(/\{\{customer_name\}\}/g, testName || 'Test Klant')
    .replace(/\{\{customer_email\}\}/g, testEmail || 'test@voorbeeld.nl')
    .replace(/\{\{company_name\}\}/g, tenantData?.name || 'Uw Bedrijf')
    .replace(/\{\{company_address\}\}/g, `${tenantData?.street || ''}, ${tenantData?.postal_code || ''} ${tenantData?.city || ''}`)
    .replace(/\{\{unsubscribe_url\}\}/g, '#')
    .replace(/\{\{preferences_url\}\}/g, '#')
    .replace(/\{\{subject\}\}/g, subject);

  const handleSendTest = async () => {
    if (!testEmail || !currentTenant?.id) {
      toast.error('Vul een geldig emailadres in');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          tenantId: currentTenant.id,
          toEmail: testEmail,
          subject,
          htmlContent,
          previewData: {
            customer_name: testName,
            customer_email: testEmail,
          },
        },
      });

      if (error) throw error;
      
      toast.success(`Test email verzonden naar ${testEmail}`);
      setDialogOpen(false);
    } catch (error) {
      console.error('Test email error:', error);
      toast.error('Fout bij verzenden van test email');
    } finally {
      setSending(false);
    }
  };

  // Simple spam score checker
  const spamChecks = [
    { 
      label: 'Onderwerp lengte', 
      passed: subject.length > 0 && subject.length <= 60,
      message: subject.length > 60 ? 'Onderwerp te lang (max 60 tekens)' : subject.length === 0 ? 'Onderwerp ontbreekt' : 'OK'
    },
    { 
      label: 'Geen CAPS LOCK', 
      passed: !/[A-Z]{5,}/.test(subject),
      message: /[A-Z]{5,}/.test(subject) ? 'Vermijd hoofdletters' : 'OK'
    },
    { 
      label: 'Unsubscribe link', 
      passed: htmlContent.includes('unsubscribe') || htmlContent.includes('uitschrijven'),
      message: htmlContent.includes('unsubscribe') || htmlContent.includes('uitschrijven') ? 'OK' : 'Voeg uitschrijflink toe'
    },
    { 
      label: 'Alt tekst afbeeldingen', 
      passed: !htmlContent.includes('alt=""') && !htmlContent.includes("alt=''"),
      message: htmlContent.includes('alt=""') ? 'Sommige afbeeldingen missen alt tekst' : 'OK'
    },
  ];

  const passedChecks = spamChecks.filter(c => c.passed).length;
  const spamScore = Math.round((passedChecks / spamChecks.length) * 100);

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="preview" className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="quality">Kwaliteit</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={device === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setDevice('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={device === 'tablet' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none border-x"
                onClick={() => setDevice('tablet')}
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={device === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setDevice('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
            
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Test verzenden
            </Button>
          </div>
        </div>

        <TabsContent value="preview" className="flex-1 bg-muted/30 p-4 overflow-auto">
          <div 
            className="mx-auto bg-white shadow-lg transition-all duration-300"
            style={{ width: deviceWidths[device], maxWidth: '100%' }}
          >
            <iframe
              srcDoc={previewHtml}
              className="w-full border-0"
              style={{ height: '600px' }}
              title="Email preview"
            />
          </div>
        </TabsContent>

        <TabsContent value="quality" className="flex-1 p-4 overflow-auto">
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <div 
                className={`text-5xl font-bold ${
                  spamScore >= 80 ? 'text-green-600' : 
                  spamScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}
              >
                {spamScore}
              </div>
              <p className="text-muted-foreground mt-1">Email Kwaliteit Score</p>
            </div>

            <div className="space-y-3">
              {spamChecks.map((check, i) => (
                <div 
                  key={i} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    check.passed ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {check.passed ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{check.label}</span>
                  </div>
                  <Badge variant={check.passed ? 'secondary' : 'destructive'}>
                    {check.message}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">💡 Tips voor betere deliverability</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Gebruik een herkenbare afzendernaam</li>
                <li>• Houd de afbeelding/tekst verhouding in balans</li>
                <li>• Vermijd spam-trigger woorden in het onderwerp</li>
                <li>• Voeg altijd een duidelijke uitschrijflink toe</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Email Verzenden</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="testEmail">Email adres</Label>
              <Input
                id="testEmail"
                type="email"
                placeholder="jouw@email.nl"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="testName">Test klantnaam (voor variabelen)</Label>
              <Input
                id="testName"
                placeholder="Jan Jansen"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
            </div>
            
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">ℹ️ Test emails bevatten:</p>
              <ul className="text-muted-foreground space-y-0.5">
                <li>• [TEST] prefix in onderwerp</li>
                <li>• Banner bovenaan dat het een test is</li>
                <li>• Ingevulde variabelen met test data</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSendTest} disabled={sending || !testEmail}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verzenden...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Verstuur Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
