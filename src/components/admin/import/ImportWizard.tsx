import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Upload, Loader2 } from 'lucide-react';
import { PlatformSelect } from './PlatformSelect';
import { FileUpload } from './FileUpload';
import { FieldMappingStep } from './FieldMappingStep';
import { PreviewValidation } from './PreviewValidation';
import { ImportResult } from './ImportResult';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { 
  ImportPlatform, 
  ImportDataType, 
  UploadedFile, 
  MappingOption,
  ImportOptions,
  PreviewRecord,
  ImportJob
} from '@/types/import';

interface ImportWizardProps {
  onComplete?: () => void;
}

export function ImportWizard({ onComplete }: ImportWizardProps) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<ImportPlatform | null>(null);
  const [selectedDataTypes, setSelectedDataTypes] = useState<ImportDataType[]>(['customers', 'products']);
  const [uploadedFiles, setUploadedFiles] = useState<Map<ImportDataType, UploadedFile>>(new Map());
  const [mappings, setMappings] = useState<Map<ImportDataType, MappingOption[]>>(new Map());
  const [previewData, setPreviewData] = useState<Map<ImportDataType, PreviewRecord[]>>(new Map());
  const [importResult, setImportResult] = useState<ImportJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    dataType: string;
    current: number;
    total: number;
    successCount: number;
    failedCount: number;
  } | null>(null);
  
  const [options, setOptions] = useState<ImportOptions>({
    skipErrors: true,
    updateExisting: false,
    batchSize: 50,
    importImages: false,
    sendWelcomeEmail: false,
  });

  const canProceed = () => {
    switch (step) {
      case 1:
        return platform !== null && selectedDataTypes.length > 0;
      case 2:
        return selectedDataTypes.every(dt => uploadedFiles.has(dt));
      case 3:
        return selectedDataTypes.every(dt => mappings.has(dt));
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < 5 && canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFileUpload = (dataType: ImportDataType, file: UploadedFile) => {
    setUploadedFiles(prev => new Map(prev).set(dataType, file));
  };

  const handleMappingChange = (dataType: ImportDataType, mapping: MappingOption[]) => {
    setMappings(prev => new Map(prev).set(dataType, mapping));
  };

  const handlePreviewChange = (dataType: ImportDataType, records: PreviewRecord[]) => {
    setPreviewData(prev => new Map(prev).set(dataType, records));
  };

  const handleStartImport = async () => {
    if (!currentTenant?.id) {
      toast({
        title: t('common.error'),
        description: 'Geen tenant geselecteerd',
        variant: 'destructive',
      });
      return;
    }

    if (!platform) return;

    setIsProcessing(true);
    setImportProgress(null);
    
    const BATCH_SIZE = 100;
    
    try {
      let lastResult: ImportJob | null = null;
      let totalSuccess = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      const allErrors: Array<{ row: number; field?: string; value?: string; error: string; severity: 'warning' | 'error' }> = [];
      
      for (const dataType of selectedDataTypes) {
        const preview = previewData.get(dataType);
        if (!preview || preview.length === 0) continue;
        
        // Get selected and transformed records (ALL of them, not just sample)
        const records = preview
          .filter(r => r.selected)
          .map(r => r.data);
        
        if (records.length === 0) continue;

        // Split into batches
        const batches: typeof records[] = [];
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          batches.push(records.slice(i, i + BATCH_SIZE));
        }

        console.log(`Processing ${dataType}: ${records.length} records in ${batches.length} batches`);

        // Process each batch
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          setImportProgress({
            dataType: t(`import.${dataType}`),
            current: batchIndex + 1,
            total: batches.length,
            successCount: totalSuccess,
            failedCount: totalFailed,
          });

          const { data, error } = await supabase.functions.invoke('run-csv-import', {
            body: {
              tenant_id: currentTenant.id,
              platform: platform,
              data_type: dataType,
              records: batch,
              options: {
                updateExisting: options.updateExisting,
                skipErrors: options.skipErrors,
              },
            },
          });
          
          if (error) {
            console.error(`Batch ${batchIndex + 1} error:`, error);
            totalFailed += batch.length;
            allErrors.push({
              row: batchIndex * BATCH_SIZE,
              error: error.message || 'Batch failed',
              severity: 'error'
            });
            continue;
          }
          
          if (data) {
            totalSuccess += data.success_count || 0;
            totalFailed += data.failed_count || 0;
            totalSkipped += data.skipped_count || 0;
            if (data.errors) {
              allErrors.push(...data.errors);
            }
          }

          // Small delay between batches to prevent overwhelming the server
          if (batchIndex < batches.length - 1) {
            await new Promise(r => setTimeout(r, 100));
          }
        }

        // Build final result for this data type
        lastResult = {
          id: crypto.randomUUID(),
          tenant_id: currentTenant.id,
          source_platform: platform,
          data_type: dataType,
          file_name: uploadedFiles.get(dataType)?.file.name || null,
          status: totalFailed > 0 && totalSuccess === 0 ? 'failed' : 'completed',
          total_rows: records.length,
          success_count: totalSuccess,
          skipped_count: totalSkipped,
          failed_count: totalFailed,
          categories_created: 0,
          categories_matched: 0,
          mapping: null,
          options: options,
          errors: allErrors,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          created_at: new Date().toISOString(),
          created_by: null,
        };
      }
      
      if (lastResult) {
        setImportResult(lastResult);
        setStep(5);
        toast({
          title: t('import.complete'),
          description: `${totalSuccess} records geïmporteerd${totalFailed > 0 ? `, ${totalFailed} mislukt` : ''}`,
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Import mislukt',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
    }
  };

  const handleNewImport = () => {
    setStep(1);
    setPlatform(null);
    setSelectedDataTypes(['customers', 'products']);
    setUploadedFiles(new Map());
    setMappings(new Map());
    setPreviewData(new Map());
    setImportResult(null);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <PlatformSelect
            selectedPlatform={platform}
            onPlatformChange={setPlatform}
            selectedDataTypes={selectedDataTypes}
            onDataTypesChange={setSelectedDataTypes}
          />
        );
      case 2:
        return (
          <FileUpload
            platform={platform!}
            dataTypes={selectedDataTypes}
            uploadedFiles={uploadedFiles}
            onFileUpload={handleFileUpload}
          />
        );
      case 3:
        return (
          <FieldMappingStep
            platform={platform!}
            dataTypes={selectedDataTypes}
            uploadedFiles={uploadedFiles}
            mappings={mappings}
            onMappingChange={handleMappingChange}
          />
        );
      case 4:
        return (
          <PreviewValidation
            dataTypes={selectedDataTypes}
            uploadedFiles={uploadedFiles}
            mappings={mappings}
            previewData={previewData}
            onPreviewChange={handlePreviewChange}
            options={options}
            onOptionsChange={setOptions}
          />
        );
      case 5:
        return importResult && (
          <ImportResult
            result={importResult}
            onNewImport={handleNewImport}
            onViewData={onComplete}
          />
        );
      default:
        return null;
    }
  };

  const stepTitles = [
    t('import.select_platform'),
    t('import.upload_files'),
    t('import.field_mapping'),
    t('import.preview'),
    t('import.complete'),
  ];

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t('import.title')}
        </CardTitle>
        <CardDescription>
          {stepTitles[step - 1]}
        </CardDescription>
        
        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        {renderStep()}
        
        {step < 5 && (
          <div className="space-y-4 mt-6 pt-4 border-t">
            {/* Progress indicator during import */}
            {importProgress && (
              <div className="space-y-2">
                <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{importProgress.dataType}: Batch {importProgress.current} van {importProgress.total}</span>
                  <span>{importProgress.successCount} geïmporteerd{importProgress.failedCount > 0 && `, ${importProgress.failedCount} mislukt`}</span>
                </div>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1 || isProcessing}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('common.back')}
              </Button>
              
              {step === 4 ? (
                <Button
                  onClick={handleStartImport}
                  disabled={!canProceed() || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('import.importing')}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t('import.start')}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {t('common.next')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
