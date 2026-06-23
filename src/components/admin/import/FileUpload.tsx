import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCSV } from '@/hooks/useImport';
import { detectPlatform, consolidateShopifyProductRows } from '@/lib/importMappings';
import * as XLSX from 'xlsx';
import type { ImportPlatform, ImportDataType, UploadedFile } from '@/types/import';

interface FileUploadProps {
  platform: ImportPlatform;
  dataTypes: ImportDataType[];
  uploadedFiles: Map<ImportDataType, UploadedFile>;
  onFileUpload: (dataType: ImportDataType, file: UploadedFile) => void;
}

export function FileUpload({
  platform,
  dataTypes,
  uploadedFiles,
  onFileUpload,
}: FileUploadProps) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState<ImportDataType | null>(null);
  const [errors, setErrors] = useState<Map<ImportDataType, string>>(new Map());
  const [isUploading, setIsUploading] = useState<ImportDataType | null>(null);

  const handleFile = useCallback(async (dataType: ImportDataType, file: File) => {
    setIsUploading(dataType);
    setErrors(prev => {
      const next = new Map(prev);
      next.delete(dataType);
      return next;
    });

    try {
      const { headers, rows } = await parseCSV(file);
      
      // Detect platform from headers if unknown
      const detectedPlatform = detectPlatform(headers);
      console.log('Detected platform:', detectedPlatform);

      // Consolidate Shopify product rows (multiple rows per product for images/variants)
      let processedRows = rows;
      if (dataType === 'products' && headers.includes('Handle') && headers.includes('Title')) {
        processedRows = consolidateShopifyProductRows(rows);
        console.log(`Product consolidation: ${rows.length} → ${processedRows.length}`);
      }

      onFileUpload(dataType, {
        file,
        dataType,
        rowCount: processedRows.length,
        headers,
        sampleData: processedRows.slice(0, 5),
        allData: processedRows,
      });
    } catch (error) {
      setErrors(prev => new Map(prev).set(
        dataType,
        error instanceof Error ? error.message : 'Failed to parse file'
      ));
    } finally {
      setIsUploading(null);
    }
  }, [onFileUpload]);

  const handleDrop = useCallback((dataType: ImportDataType, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.json'))) {
      handleFile(dataType, file);
    }
  }, [handleFile]);

  const handleInputChange = (dataType: ImportDataType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(dataType, file);
    }
  };

  const removeFile = (dataType: ImportDataType) => {
    // Remove file by setting empty state - parent needs to handle this
    // For now, we'll just reload
    window.location.reload();
  };

  const TEMPLATE_HEADERS = [
    'name','sku','price','compare_at_price','cost_price','barcode','stock','category',
    'description','short_description','tags','images','featured_image','vendor','weight',
    'meta_title','meta_description','is_active','track_inventory',
  ];
  const TEMPLATE_EXAMPLE = [
    'Voorbeeld Product','SKU-001','19.99','24.99','8.00','8711234567890','10','Voorbeeldcategorie',
    '<p>Volledige productomschrijving.</p>','Korte omschrijving','tag1|tag2',
    'https://cdn.example.com/img1.jpg|https://cdn.example.com/img2.jpg','',
    'Voorbeeld Merk','0.50','Voorbeeld Product','SEO meta omschrijving.','true','true',
  ];

  const downloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const instructions = [
      ['SellQo product-import template'],
      [],
      ['Vul het tabblad "Producten" in. Verplichte kolommen: name, sku, price.'],
      ['Scheid meerdere tags of images met een pipe-teken (|).'],
      ['is_active en track_inventory accepteren true/false of yes/no.'],
      [],
      ['Kolom', 'Omschrijving'],
      ...TEMPLATE_HEADERS.map((h) => [h, '']),
    ];
    const wsI = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsI, 'Instructies');
    const wsP = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
    XLSX.utils.book_append_sheet(wb, wsP, 'Producten');
    XLSX.writeFile(wb, 'sellqo-product-import-template.xlsx');
  };

  const downloadCsvTemplate = () => {
    const escape = (v: string) => {
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const csv =
      '\uFEFF' +
      [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.map(escape).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'application/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sellqo-product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {platform === 'csv' && (
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-muted/40">
          <div className="flex-1">
            <p className="font-medium">Download een template</p>
            <p className="text-sm text-muted-foreground">
              Gebruik de juiste kolomnamen — dan wordt alles automatisch gemapt.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadExcelTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Excel-template
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate}>
              <Download className="h-4 w-4 mr-2" />
              CSV-template
            </Button>
          </div>
        </Card>
      )}

      {dataTypes.map((dataType) => {
        const uploaded = uploadedFiles.get(dataType);
        const error = errors.get(dataType);
        const uploading = isUploading === dataType;

        return (
          <div key={dataType}>
            <Label className="text-base font-semibold capitalize">
              {t(`import.${dataType}`)}
            </Label>
            
            {uploaded ? (
              <Card className="mt-2 p-4 flex items-center gap-4 bg-muted/50">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{uploaded.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('import.rows_detected', { count: uploaded.rowCount })}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(dataType)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            ) : (
              <Card
                className={cn(
                  'mt-2 p-8 border-2 border-dashed transition-colors cursor-pointer',
                  'flex flex-col items-center justify-center text-center',
                  dragOver === dataType && 'border-primary bg-primary/5',
                  error && 'border-destructive'
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(dataType);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(dataType, e)}
              >
                <input
                  type="file"
                  accept=".csv,.xlsx,.json"
                  className="hidden"
                  id={`file-${dataType}`}
                  onChange={(e) => handleInputChange(dataType, e)}
                />
                <label
                  htmlFor={`file-${dataType}`}
                  className="cursor-pointer flex flex-col items-center"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                  ) : (
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  )}
                  <p className="font-medium mb-1">
                    {t('import.drop_or_click')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('import.supported_formats')}
                  </p>
                </label>
                
                {error && (
                  <div className="flex items-center gap-2 mt-3 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
              </Card>
            )}
          </div>
        );
      })}

      {/* Platform-specific tips */}
      {platform !== 'csv' && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>{t('import.platform_tip', { platform: platform.charAt(0).toUpperCase() + platform.slice(1) })}:</strong>{' '}
            {t(`import.${platform}_export_tip`)}
          </p>
        </Card>
      )}

      {platform === 'csv' && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Tip:</strong> Download eerst de template hierboven. Verplichte
            kolommen zijn <code>name</code>, <code>sku</code> en <code>price</code>.
            Meerdere tags of images scheid je met een pipe-teken (<code>|</code>).
          </p>
        </Card>
      )}
    </div>
  );
}
