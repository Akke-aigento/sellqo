import { ReactNode, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExportFormat } from '@/lib/exportUtils';

interface ReportCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  formats?: ExportFormat[];
  onExport: (format: ExportFormat) => Promise<void>;
  recordCount?: number;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ReportCard = ({
  title,
  description,
  icon,
  formats = ['csv', 'xlsx'],
  onExport,
  recordCount,
  isLoading = false,
  disabled = false,
}: ReportCardProps) => {
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    try {
      await onExport(format);
    } finally {
      setExportingFormat(null);
    }
  };

  const formatLabels: Record<ExportFormat, { label: string; icon: ReactNode }> = {
    csv: { label: 'CSV', icon: <FileText className="h-4 w-4" /> },
    xlsx: { label: 'Excel', icon: <FileSpreadsheet className="h-4 w-4" /> },
    pdf: { label: 'PDF', icon: <FileText className="h-4 w-4" /> },
  };

  const isExporting = isLoading || exportingFormat !== null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
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
        <div className="flex items-center justify-between">
          {recordCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {recordCount.toLocaleString('nl-NL')} records
            </span>
          )}
          {recordCount === undefined && <span />}
          
          {formats.length === 1 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport(formats[0])}
              disabled={disabled || isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {formatLabels[formats[0]].label}
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={disabled || isExporting}>
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Exporteren
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {formats.map((format) => (
                  <DropdownMenuItem
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={exportingFormat === format}
                  >
                    {formatLabels[format].icon}
                    <span className="ml-2">{formatLabels[format].label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
