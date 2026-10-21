import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, AlertTriangle, FileCheck, Building2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInvoiceCompliance, type ComplianceCheck } from '@/hooks/useInvoiceCompliance';
import { cn } from '@/lib/utils';

/** `labelKey` is een i18n-key; vertaald in de component. */
const categoryLabels: Record<string, { labelKey: string; icon: React.ReactNode }> = {
  seller: { labelKey: 'settings.compliance.categories.seller', icon: <Building2 className="h-4 w-4" /> },
  invoice: { labelKey: 'settings.compliance.categories.invoice', icon: <FileCheck className="h-4 w-4" /> },
  financial: { labelKey: 'settings.compliance.categories.financial', icon: <CreditCard className="h-4 w-4" /> },
};

function ComplianceCheckItem({ check }: { check: ComplianceCheck }) {
  const { t } = useTranslation();
  const Icon = check.passed 
    ? CheckCircle2 
    : check.severity === 'error' 
      ? AlertCircle 
      : AlertTriangle;

  return (
    <div className={cn(
      "flex items-center justify-between py-2 px-3 rounded-md",
      !check.passed && check.severity === 'error' && "bg-destructive/10",
      !check.passed && check.severity === 'warning' && "bg-amber-500/10",
      check.passed && "bg-muted/50"
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn(
          "h-4 w-4",
          check.passed && "text-green-600",
          !check.passed && check.severity === 'error' && "text-destructive",
          !check.passed && check.severity === 'warning' && "text-amber-600"
        )} />
        <span className="text-sm">{t(`settings.compliance.checks.${check.id}`, { defaultValue: check.label })}</span>
        {!check.required && (
          <Badge variant="outline" className="text-xs">{t('settings.compliance.optional')}</Badge>
        )}
      </div>
      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
        {check.value || <span className="italic">{t('settings.compliance.notFilled')}</span>}
      </div>
    </div>
  );
}

export function InvoiceComplianceCard() {
  const { t } = useTranslation();
  const { checks, isCompliant, errorCount, warningCount } = useInvoiceCompliance();

  // Group checks by category
  const groupedChecks = checks.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = [];
    }
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, ComplianceCheck[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isCompliant ? "bg-green-100" : "bg-destructive/10"
            )}>
              <FileCheck className={cn(
                "h-6 w-6",
                isCompliant ? "text-green-600" : "text-destructive"
              )} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {t('settings.compliance.title')}
                {isCompliant ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    {t('settings.compliance.compliant')}
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    {t('settings.compliance.missingRequired', { n: errorCount })}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {t('settings.compliance.description')}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isCompliant ? (
          <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <span>{t('settings.compliance.allGood')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{t('settings.compliance.missingFields')}</span>
          </div>
        )}

        {warningCount > 0 && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <span>{t('settings.compliance.optionalMissing', { n: warningCount })}</span>
          </div>
        )}

        {Object.entries(groupedChecks).map(([category, categoryChecks]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              {categoryLabels[category]?.icon}
              <h4 className="font-semibold">{categoryLabels[category] ? t(categoryLabels[category].labelKey) : category}</h4>
              <Badge variant="outline" className="ml-auto">
                {categoryChecks.filter(c => c.passed).length}/{categoryChecks.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {categoryChecks.map((check) => (
                <ComplianceCheckItem key={check.id} check={check} />
              ))}
            </div>
          </div>
        ))}

        <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium mb-2">{t('settings.compliance.requiredListTitle')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{t('settings.compliance.requiredList.seller')}</li>
            <li>{t('settings.compliance.requiredList.companyNumber')}</li>
            <li>{t('settings.compliance.requiredList.iban')}</li>
            <li>{t('settings.compliance.requiredList.invoiceNumber')}</li>
            <li>{t('settings.compliance.requiredList.dates')}</li>
            <li>{t('settings.compliance.requiredList.vatAmount')}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
