import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Check, AlertTriangle, X, Sparkles, Search } from 'lucide-react';
import { transformRecord, validateRecord } from '@/lib/importMappings';
import type { 
  ImportDataType, 
  UploadedFile, 
  MappingOption,
  PreviewRecord,
  ImportOptions 
} from '@/types/import';

interface PreviewValidationProps {
  dataTypes: ImportDataType[];
  uploadedFiles: Map<ImportDataType, UploadedFile>;
  mappings: Map<ImportDataType, MappingOption[]>;
  previewData: Map<ImportDataType, PreviewRecord[]>;
  onPreviewChange: (dataType: ImportDataType, records: PreviewRecord[]) => void;
  options: ImportOptions;
  onOptionsChange: (options: ImportOptions) => void;
}

export function PreviewValidation({
  dataTypes,
  uploadedFiles,
  mappings,
  previewData,
  onPreviewChange,
  options,
  onOptionsChange,
}: PreviewValidationProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(dataTypes[0]);

  // Process and validate all records
  useEffect(() => {
    dataTypes.forEach(dataType => {
      if (!previewData.has(dataType)) {
        const file = uploadedFiles.get(dataType);
        const mapping = mappings.get(dataType);
        
        if (file && mapping) {
          // Build field mapping object
          const fieldMapping: Record<string, { target: string | null; transform?: string }> = {};
          mapping.forEach(m => {
            fieldMapping[m.sourceField] = { 
              target: m.targetField, 
              transform: m.transform 
            };
          });

          // Transform and validate all records
          const records: PreviewRecord[] = file.sampleData.map((row, index) => {
            const transformed = transformRecord(row, fieldMapping);
            const validation = validateRecord(transformed, dataType);
            
            return {
              index,
              data: transformed,
              errors: validation.errors.map(e => e.error),
              warnings: [],
              selected: validation.valid,
            };
          });

          onPreviewChange(dataType, records);
        }
      }
    });
  }, [dataTypes, uploadedFiles, mappings, previewData, onPreviewChange]);

  // Calculate SEO statistics for products
  const getSEOStats = () => {
    const productRecords = previewData.get('products') || [];
    const withSEO = productRecords.filter(r => 
      r.data.meta_title && r.data.meta_description
    ).length;
    const withPartialSEO = productRecords.filter(r => 
      (r.data.meta_title || r.data.meta_description) && 
      !(r.data.meta_title && r.data.meta_description)
    ).length;
    const withoutSEO = productRecords.length - withSEO - withPartialSEO;
    
    return { withSEO, withPartialSEO, withoutSEO, total: productRecords.length };
  };

  const seoStats = getSEOStats();

  const getStats = (dataType: ImportDataType) => {
    const records = previewData.get(dataType) || [];
    const file = uploadedFiles.get(dataType);
    const totalRows = file?.rowCount || 0;
    
    const valid = records.filter(r => r.errors.length === 0 && r.selected).length;
    const warnings = records.filter(r => r.warnings.length > 0).length;
    const errors = records.filter(r => r.errors.length > 0).length;
    
    return { valid, warnings, errors, totalRows };
  };

  const toggleRecord = (dataType: ImportDataType, index: number) => {
    const records = previewData.get(dataType) || [];
    const updated = records.map(r => 
      r.index === index ? { ...r, selected: !r.selected } : r
    );
    onPreviewChange(dataType, updated);
  };

  const getDisplayColumns = (dataType: ImportDataType): string[] => {
    switch (dataType) {
      case 'customers':
        return ['first_name', 'last_name', 'email', 'billing_country'];
      case 'products':
        return ['name', 'sku', 'price', 'vendor'];
      case 'orders':
        return ['order_number', 'customer_email', 'total', 'payment_status', 'status'];
      case 'categories':
        return ['name', 'slug', 'description'];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Validation Summary */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">
          {t('import.validation_results')}
        </Label>
        <div className="grid grid-cols-3 gap-4">
          {dataTypes.map(dt => {
            const stats = getStats(dt);
            return (
              <div key={dt} className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground capitalize mb-1">
                  {t(`import.${dt}`)}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="flex items-center text-green-600 text-sm">
                    <Check className="h-4 w-4 mr-1" />
                    {stats.valid}
                  </span>
                  {stats.warnings > 0 && (
                    <span className="flex items-center text-yellow-600 text-sm">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      {stats.warnings}
                    </span>
                  )}
                  {stats.errors > 0 && (
                    <span className="flex items-center text-red-600 text-sm">
                      <X className="h-4 w-4 mr-1" />
                      {stats.errors}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* SEO Import Feedback */}
      {dataTypes.includes('products') && seoStats.total > 0 && seoStats.withoutSEO > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
          <Search className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>{seoStats.withoutSEO} producten</strong> hebben geen SEO data (meta titel/beschrijving).
            {seoStats.withPartialSEO > 0 && (
              <span> Daarnaast hebben <strong>{seoStats.withPartialSEO} producten</strong> onvolledige SEO data.</span>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>
                Gebruik na import de{' '}
                <Link 
                  to="/admin/marketing/seo" 
                  className="font-medium underline hover:text-yellow-900 dark:hover:text-yellow-100"
                >
                  AI SEO Generator
                </Link>{' '}
                om automatisch geoptimaliseerde meta titels en beschrijvingen te genereren.
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Table */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportDataType)}>
        <TabsList>
          {dataTypes.map(dt => (
            <TabsTrigger key={dt} value={dt} className="capitalize">
              {t(`import.${dt}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {dataTypes.map(dataType => {
          const records = previewData.get(dataType) || [];
          const columns = getDisplayColumns(dataType);

          return (
            <TabsContent key={dataType} value={dataType}>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      {columns.map(col => (
                        <TableHead key={col} className="capitalize">
                          {col.replace(/_/g, ' ')}
                        </TableHead>
                      ))}
                      <TableHead>{t('common.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow 
                        key={record.index}
                        className={record.errors.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={record.selected}
                            onCheckedChange={() => toggleRecord(dataType, record.index)}
                            disabled={record.errors.length > 0 && !options.skipErrors}
                          />
                        </TableCell>
                        {columns.map(col => (
                          <TableCell key={col} className="font-mono text-sm">
                            {String(record.data[col] || '-')}
                          </TableCell>
                        ))}
                        <TableCell>
                          {record.errors.length > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              <X className="h-3 w-3 mr-1" />
                              {record.errors[0]}
                            </Badge>
                          ) : record.warnings.length > 0 ? (
                            <Badge variant="outline" className="text-yellow-600 text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {record.warnings[0]}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 text-xs">
                              <Check className="h-3 w-3" />
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Import Options */}
      <Card className="p-4 space-y-4">
        <Label className="text-base font-semibold">
          {t('import.options')}
        </Label>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{t('import.skip_errors')}</p>
            <p className="text-sm text-muted-foreground">
              {t('import.skip_errors_description')}
            </p>
          </div>
          <Switch
            checked={options.skipErrors}
            onCheckedChange={(checked) => 
              onOptionsChange({ ...options, skipErrors: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{t('import.update_existing')}</p>
            <p className="text-sm text-muted-foreground">
              {t('import.update_existing_description')}
            </p>
          </div>
          <Switch
            checked={options.updateExisting}
            onCheckedChange={(checked) => 
              onOptionsChange({ ...options, updateExisting: checked })
            }
          />
        </div>
      </Card>
    </div>
  );
}
