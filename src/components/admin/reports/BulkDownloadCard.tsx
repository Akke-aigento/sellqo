import { ReactNode } from 'react';
import { Download, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface BulkDownloadCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  count?: number;
  estimatedSize?: string;
  onDownload: () => Promise<void>;
  isDownloading?: boolean;
  progress?: { current: number; total: number };
  disabled?: boolean;
}

export const BulkDownloadCard = ({
  title,
  description,
  icon = <Package className="h-5 w-5" />,
  count,
  estimatedSize,
  onDownload,
  isDownloading = false,
  progress,
  disabled = false,
}: BulkDownloadCardProps) => {
  const progressPercentage = progress && progress.total > 0 
    ? (progress.current / progress.total) * 100 
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600">
              {icon}
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm mt-1">{description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isDownloading && progress && progress.total > 0 ? (
          <div className="space-y-2">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progress.current} van {progress.total} bestanden...
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {count !== undefined && (
                <span>{count.toLocaleString('nl-NL')} bestanden</span>
              )}
              {estimatedSize && count !== undefined && <span className="mx-2">•</span>}
              {estimatedSize && <span>~{estimatedSize}</span>}
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={onDownload}
              disabled={disabled || isDownloading || count === 0}
              className="border-orange-200 hover:bg-orange-50 hover:text-orange-700"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              ZIP Downloaden
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
