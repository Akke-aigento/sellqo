import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Upload, Loader2 } from 'lucide-react';
import { PlatformSelect } from './PlatformSelect';
import { FileUpload } from './FileUpload';
import { FieldMappingStep } from './FieldMappingStep';
import { PreviewValidation } from './PreviewValidation';
import { ImportResult } from './ImportResult';
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
  
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<ImportPlatform | null>(null);
  const [selectedDataTypes, setSelectedDataTypes] = useState<ImportDataType[]>(['customers', 'products']);
  const [uploadedFiles, setUploadedFiles] = useState<Map<ImportDataType, UploadedFile>>(new Map());
  const [mappings, setMappings] = useState<Map<ImportDataType, MappingOption[]>>(new Map());
  const [previewData, setPreviewData] = useState<Map<ImportDataType, PreviewRecord[]>>(new Map());
  const [importResult, setImportResult] = useState<ImportJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
    setIsProcessing(true);
    try {
      // TODO: Implement actual import via edge function
      // For now, simulate success
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setImportResult({
        id: 'mock-id',
        tenant_id: 'mock-tenant',
        source_platform: platform!,
        data_type: selectedDataTypes[0],
        file_name: uploadedFiles.get(selectedDataTypes[0])?.file.name || null,
        status: 'completed',
        total_rows: 51,
        success_count: 48,
        skipped_count: 2,
        failed_count: 1,
        categories_created: 0,
        categories_matched: 0,
        mapping: null,
        options: null,
        errors: [
          { row: 3, error: 'Invalid email format', severity: 'error' },
        ],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 3200,
        created_at: new Date().toISOString(),
        created_by: null,
      });
      
      setStep(5);
    } finally {
      setIsProcessing(false);
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
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
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
        )}
      </CardContent>
    </Card>
  );
}
