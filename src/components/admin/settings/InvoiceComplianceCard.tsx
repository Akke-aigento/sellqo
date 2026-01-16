import { CheckCircle2, AlertCircle, AlertTriangle, FileCheck, Building2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInvoiceCompliance, type ComplianceCheck } from '@/hooks/useInvoiceCompliance';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  seller: { label: 'Bedrijfsgegevens', icon: <Building2 className="h-4 w-4" /> },
  invoice: { label: 'Facturatie', icon: <FileCheck className="h-4 w-4" /> },
  financial: { label: 'Financieel', icon: <CreditCard className="h-4 w-4" /> },
};

function ComplianceCheckItem({ check }: { check: ComplianceCheck }) {
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
        <span className="text-sm">{check.label}</span>
        {!check.required && (
          <Badge variant="outline" className="text-xs">optioneel</Badge>
        )}
      </div>
      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
        {check.value || <span className="italic">Niet ingevuld</span>}
      </div>
    </div>
  );
}

export function InvoiceComplianceCard() {
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
                Belgische Factuur Compliance
                {isCompliant ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    Compliant
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    {errorCount} vereiste velden ontbreken
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Controleer of alle verplichte velden voor Belgische facturen zijn ingevuld
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isCompliant ? (
          <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <span>Alle verplichte factuurvelden zijn correct ingevuld. Je facturen voldoen aan de Belgische wettelijke eisen.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Er ontbreken verplichte velden. Vul deze in om compliant te zijn met Belgische facturatiewetgeving.</span>
          </div>
        )}

        {warningCount > 0 && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <span>{warningCount} optionele velden zijn niet ingevuld. Deze worden aanbevolen maar zijn niet verplicht.</span>
          </div>
        )}

        {Object.entries(groupedChecks).map(([category, categoryChecks]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              {categoryLabels[category]?.icon}
              <h4 className="font-semibold">{categoryLabels[category]?.label}</h4>
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
          <p className="font-medium mb-2">Verplichte velden voor Belgische facturen:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Volledige naam en adres van verkoper</li>
            <li>Ondernemingsnummer (KBO) of BTW-nummer</li>
            <li>IBAN bankrekeningnummer</li>
            <li>Uniek, opeenvolgend factuurnummer</li>
            <li>Factuurdatum en vervaldatum</li>
            <li>BTW-bedrag per tarief</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
