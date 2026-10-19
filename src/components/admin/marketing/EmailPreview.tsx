import { useEffect, useState } from 'react';
import { Monitor, Smartphone, Tablet, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface EmailPreviewProps {
  htmlContent: string;
  subject: string;
  showTestDialog?: boolean;
  onTestDialogChange?: (open: boolean) => void;
  /**
   * MAIL-1a: 'button' toont alleen de knop "Testmail versturen" met de testdialoog
   * (voor naast een editor die al een eigen voorbeeld heeft); 'full' is de volledige preview.
   */
  variant?: 'full' | 'button';
  /** Knop uitschakelen, bv. zolang onderwerp of inhoud ontbreekt. */
  disabled?: boolean;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceWidths: Record<DeviceType, number> = {
  desktop: 600,
  tablet: 480,
  mobile: 320,
};

export function EmailPreview({ htmlContent, subject, showTestDialog, onTestDialogChange, variant = 'full', disabled }: EmailPreviewProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [testEmail, setTestEmail] = useState(user?.email ?? '');
  const [testName, setTestName] = useState(() => t('admin.marketing.emailPreview.test_klant'));

  // Vul het adres van de ingelogde gebruiker in zodra dat bekend is.
  useEffect(() => {
    if (user?.email) setTestEmail((current) => current || user.email || '');
  }, [user?.email]);
  const [sending, setSending] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const { currentTenant } = useTenant();

  const dialogOpen = showTestDialog ?? testDialogOpen;
  const setDialogOpen = onTestDialogChange ?? setTestDialogOpen;

  // Replace template variables for preview
  const tenantData = currentTenant as { name?: string; street?: string; postal_code?: string; city?: string } | null;
  const previewHtml = htmlContent
    .replace(/\{\{customer_name\}\}/g, testName || t('admin.marketing.emailPreview.test_klant'))
    .replace(/\{\{customer_email\}\}/g, testEmail || t('admin.marketing.emailPreview.jouw_email_nl'))
    .replace(/\{\{company_name\}\}/g, tenantData?.name || t('admin.marketing.emailPreview.uw_bedrijf'))
    .replace(/\{\{company_address\}\}/g, `${tenantData?.street || ''}, ${tenantData?.postal_code || ''} ${tenantData?.city || ''}`)
    .replace(/\{\{unsubscribe_url\}\}/g, '#')
    .replace(/\{\{preferences_url\}\}/g, '#')
    .replace(/\{\{subject\}\}/g, subject);

  const handleSendTest = async () => {
    if (!testEmail || !currentTenant?.id) {
      toast.error(t('admin.marketing.emailPreview.vul_geldig_emailadres_in'));
      return;
    }

    setSending(true);
    try {
      await invokeWithErrorBody('send-test-email', {
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
      }, t('admin.marketing.emailPreview.fout_bij_verzenden_test'));

      toast.success(t('admin.marketing.emailPreview.test_verzonden_naar', { email: testEmail }));
      setDialogOpen(false);
    } catch (error) {
      console.error('Test email error:', error);
      toast.error(t('admin.marketing.emailPreview.fout_bij_verzenden_test'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  // Simple spam score checker
  const spamChecks = [
    { 
      label: t('admin.marketing.emailPreview.onderwerp_lengte'), 
      passed: subject.length > 0 && subject.length <= 60,
      message: subject.length > 60
        ? t('admin.marketing.emailPreview.onderwerp_te_lang')
        : subject.length === 0 ? t('admin.marketing.emailPreview.onderwerp_ontbreekt') : t('admin.marketing.emailPreview.ok')
    },
    { 
      label: t('admin.marketing.emailPreview.geen_caps_lock'), 
      passed: !/[A-Z]{5,}/.test(subject),
      message: /[A-Z]{5,}/.test(subject) ? t('admin.marketing.emailPreview.vermijd_hoofdletters') : t('admin.marketing.emailPreview.ok')
    },
    { 
      label: t('admin.marketing.emailPreview.unsubscribe_link'), 
      passed: htmlContent.includes('unsubscribe') || htmlContent.includes('uitschrijven'),
      message: htmlContent.includes('unsubscribe') || htmlContent.includes('uitschrijven') ? t('admin.marketing.emailPreview.ok') : t('admin.marketing.emailPreview.voeg_uitschrijflink_toe')
    },
    { 
      label: t('admin.marketing.emailPreview.alt_tekst_afbeeldingen'), 
      passed: !htmlContent.includes('alt=""') && !htmlContent.includes("alt=''"),
      message: htmlContent.includes('alt=""') ? t('admin.marketing.emailPreview.afbeeldingen_missen_alt') : t('admin.marketing.emailPreview.ok')
    },
  ];

  const testDialog = (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.marketing.emailPreview.test_email_verzenden')}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="testEmail">{t('admin.marketing.emailPreview.email_adres')}</Label>
                <Input
                  id="testEmail"
                  type="email"
                  placeholder={t('admin.marketing.emailPreview.jouw_email_nl')}
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="testName">{t('admin.marketing.emailPreview.test_klantnaam_voor_variabelen')}</Label>
                <Input
                  id="testName"
                  placeholder={t('admin.marketing.emailPreview.jan_jansen')}
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                />
              </div>
              
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">{t('admin.marketing.emailPreview.test_emails_bevatten')}</p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>{t('admin.marketing.emailPreview.test_prefix_in_onderwerp')}</li>
                  <li>{t('admin.marketing.emailPreview.banner_bovenaan_dat_het_een_test')}</li>
                  <li>{t('admin.marketing.emailPreview.ingevulde_variabelen_met_test_data')}</li>
                </ul>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={handleSendTest} disabled={sending || !testEmail}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('admin.marketing.emailPreview.verzenden')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t('admin.marketing.emailPreview.verstuur_test')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );

  if (variant === 'button') {
    return (
      <>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setDialogOpen(true)} disabled={disabled}>
          <Send className="h-3.5 w-3.5" />
          {t('admin.marketing.emailPreview.testmail_versturen')}
        </Button>
        {testDialog}
      </>
    );
  }

  const passedChecks = spamChecks.filter(c => c.passed).length;
  const spamScore = Math.round((passedChecks / spamChecks.length) * 100);

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="preview" className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <TabsList>
            <TabsTrigger value="preview">{t('admin.marketing.emailPreview.preview')}</TabsTrigger>
            <TabsTrigger value="quality">{t('admin.marketing.emailPreview.kwaliteit')}</TabsTrigger>
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
              {t('admin.marketing.emailPreview.test_verzenden')}
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
              title={t('admin.marketing.emailPreview.email_preview')}
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
              <p className="text-muted-foreground mt-1">{t('admin.marketing.emailPreview.email_kwaliteit_score')}</p>
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
              <h4 className="font-medium mb-2">{t('admin.marketing.emailPreview.tips_voor_betere_deliverability')}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>{t('admin.marketing.emailPreview.gebruik_een_herkenbare_afzendernaam')}</li>
                <li>{t('admin.marketing.emailPreview.houd_de_afbeelding_tekst_verhouding_in')}</li>
                <li>{t('admin.marketing.emailPreview.vermijd_spam_trigger_woorden_in_het')}</li>
                <li>{t('admin.marketing.emailPreview.voeg_altijd_een_duidelijke_uitschrijflink_toe')}</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {testDialog}
    </div>
  );
}
