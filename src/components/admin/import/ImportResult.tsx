import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  AlertTriangle,
  X,
  Download,
  ExternalLink,
  Upload,
} from 'lucide-react';
import type { PerTypeImportResult } from './ImportWizard';

interface ImportResultProps {
  results: PerTypeImportResult[];
  onNewImport: () => void;
  onViewData?: () => void;
}

export function ImportResult({ results, onNewImport, onViewData }: ImportResultProps) {
  const { t } = useTranslation();

  const totals = results.reduce(
    (acc, r) => {
      acc.total += r.total;
      acc.success += r.success;
      acc.failed += r.failed;
      acc.skipped += r.skipped;
      return acc;
    },
    { total: 0, success: 0, failed: 0, skipped: 0 },
  );

  const downloadLog = () => {
    const blob = new Blob([JSON.stringify({ results, totals }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">{t('import.complete')} ✓</h2>
      </div>

      {/* Per-datatype resultaten */}
      <div className="space-y-4 max-w-2xl mx-auto">
        {results.map((r) => (
          <Card key={r.dataType} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold capitalize">{t(`import.${r.dataType}`)}</p>
                {r.fileName && (
                  <p className="text-xs text-muted-foreground">{r.fileName}</p>
                )}
              </div>
              <Badge variant="outline">
                {r.total} {t('import.row', { count: r.total })}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="font-bold">{r.success}</span>
                <span className="text-muted-foreground">{t('import.imported')}</span>
              </div>
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-bold">{r.skipped}</span>
                <span className="text-muted-foreground">{t('import.skipped')}</span>
              </div>
              <div className="flex items-center gap-2 text-red-600">
                <X className="h-4 w-4" />
                <span className="font-bold">{r.failed}</span>
                <span className="text-muted-foreground">{t('import.failed')}</span>
              </div>
            </div>
            {r.errors.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1 max-h-40 overflow-y-auto">
                {r.errors.slice(0, 20).map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2 bg-muted rounded">
                    <Badge
                      variant={err.severity === 'error' ? 'destructive' : 'outline'}
                      className="shrink-0"
                    >
                      {t('import.row')} {err.row}
                    </Badge>
                    <span className="text-muted-foreground break-words">{err.error}</span>
                  </div>
                ))}
                {r.errors.length > 20 && (
                  <p className="text-xs text-muted-foreground">
                    +{r.errors.length - 20} {t('import.more_errors', 'meer fouten')}
                  </p>
                )}
              </div>
            )}
          </Card>
        ))}

        {results.length > 1 && (
          <Card className="p-4 bg-muted/40">
            <p className="font-semibold mb-2">{t('common.total', 'Totaal')}</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="font-bold">{totals.success}</span>
              </div>
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-bold">{totals.skipped}</span>
              </div>
              <div className="flex items-center gap-2 text-red-600">
                <X className="h-4 w-4" />
                <span className="font-bold">{totals.failed}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={downloadLog}>
          <Download className="mr-2 h-4 w-4" />
          {t('import.download_log')}
        </Button>
        {onViewData && (
          <Button variant="outline" onClick={onViewData}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('import.view_data')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onNewImport}>
          <Upload className="mr-2 h-4 w-4" />
          {t('import.import_more')}
        </Button>
        <Button onClick={onViewData}>{t('common.done')}</Button>
      </div>
    </div>
  );
}
