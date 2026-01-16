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
  Clock
} from 'lucide-react';
import type { ImportJob } from '@/types/import';

interface ImportResultProps {
  result: ImportJob;
  onNewImport: () => void;
  onViewData?: () => void;
}

export function ImportResult({ result, onNewImport, onViewData }: ImportResultProps) {
  const { t } = useTranslation();

  const downloadLog = () => {
    const logContent = {
      job_id: result.id,
      platform: result.source_platform,
      data_type: result.data_type,
      status: result.status,
      statistics: {
        total: result.total_rows,
        success: result.success_count,
        skipped: result.skipped_count,
        failed: result.failed_count,
      },
      errors: result.errors,
      duration_ms: result.duration_ms,
      completed_at: result.completed_at,
    };

    const blob = new Blob([JSON.stringify(logContent, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-log-${result.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalProcessed = result.success_count + result.skipped_count + result.failed_count;

  return (
    <div className="space-y-6 text-center">
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="h-10 w-10 text-green-600" />
        </div>
      </div>

      <h2 className="text-2xl font-bold">{t('import.complete')} ✓</h2>

      {/* Stats Cards */}
      <Card className="p-6 max-w-md mx-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              {t('import.imported')}
            </span>
            <span className="text-xl font-bold">{result.success_count}</span>
          </div>

          {result.skipped_count > 0 && (
            <div className="flex items-center justify-between py-2 border-t">
              <span className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                {t('import.skipped')}
              </span>
              <span className="text-xl font-bold">{result.skipped_count}</span>
            </div>
          )}

          {result.failed_count > 0 && (
            <div className="flex items-center justify-between py-2 border-t">
              <span className="flex items-center gap-2 text-red-600">
                <X className="h-5 w-5" />
                {t('import.failed')}
              </span>
              <span className="text-xl font-bold">{result.failed_count}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-t text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('import.duration')}
            </span>
            <span>{((result.duration_ms || 0) / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </Card>

      {/* Errors List */}
      {result.errors.length > 0 && (
        <Card className="p-4 max-w-md mx-auto text-left">
          <h3 className="font-semibold mb-3">{t('import.issues')}:</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {result.errors.map((error, index) => (
              <div 
                key={index}
                className="flex items-start gap-2 text-sm p-2 bg-muted rounded"
              >
                <Badge 
                  variant={error.severity === 'error' ? 'destructive' : 'outline'}
                  className="shrink-0"
                >
                  {t('import.row')} {error.row}
                </Badge>
                <span className="text-muted-foreground">{error.error}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Buttons */}
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
        
        <Button onClick={onViewData}>
          {t('common.done')}
        </Button>
      </div>
    </div>
  );
}
