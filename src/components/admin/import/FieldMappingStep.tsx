import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Check, AlertTriangle, Minus } from 'lucide-react';
import { getDefaultMapping } from '@/lib/importMappings';
import { 
  CUSTOMER_TARGET_FIELDS, 
  PRODUCT_TARGET_FIELDS 
} from '@/types/import';
import type { 
  ImportPlatform, 
  ImportDataType, 
  UploadedFile, 
  MappingOption 
} from '@/types/import';

interface FieldMappingStepProps {
  platform: ImportPlatform;
  dataTypes: ImportDataType[];
  uploadedFiles: Map<ImportDataType, UploadedFile>;
  mappings: Map<ImportDataType, MappingOption[]>;
  onMappingChange: (dataType: ImportDataType, mapping: MappingOption[]) => void;
}

export function FieldMappingStep({
  platform,
  dataTypes,
  uploadedFiles,
  mappings,
  onMappingChange,
}: FieldMappingStepProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(dataTypes[0]);
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  // Initialize mappings from default platform mappings
  useEffect(() => {
    dataTypes.forEach(dataType => {
      if (!mappings.has(dataType)) {
        const file = uploadedFiles.get(dataType);
        if (file) {
          const defaultMapping = getDefaultMapping(platform, dataType);
          const newMappings: MappingOption[] = file.headers.map(header => {
            const config = defaultMapping[header];
            return {
              sourceField: header,
              targetField: config?.target || null,
              confidence: config ? 0.9 : 0.5,
              transform: config?.transform,
            };
          });
          onMappingChange(dataType, newMappings);
        }
      }
    });
  }, [dataTypes, uploadedFiles, platform, mappings, onMappingChange]);

  const getTargetFields = (dataType: ImportDataType): readonly string[] => {
    switch (dataType) {
      case 'customers':
        return CUSTOMER_TARGET_FIELDS;
      case 'products':
        return PRODUCT_TARGET_FIELDS;
      default:
        return [];
    }
  };

  const handleFieldChange = (
    dataType: ImportDataType, 
    sourceField: string, 
    targetField: string | null
  ) => {
    const currentMappings = mappings.get(dataType) || [];
    const updated = currentMappings.map(m => 
      m.sourceField === sourceField 
        ? { ...m, targetField: targetField === 'skip' ? null : targetField, confidence: 1 }
        : m
    );
    onMappingChange(dataType, updated);
  };

  const handleAutoMap = async () => {
    setIsAutoMapping(true);
    // TODO: Call AI mapping edge function
    // For now, just use default mappings
    setTimeout(() => {
      setIsAutoMapping(false);
    }, 1000);
  };

  const getMappingStats = (dataType: ImportDataType) => {
    const currentMappings = mappings.get(dataType) || [];
    const mapped = currentMappings.filter(m => m.targetField).length;
    const skipped = currentMappings.filter(m => !m.targetField).length;
    const total = currentMappings.length;
    return { mapped, skipped, total };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          {t('import.field_mapping')}
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoMap}
          disabled={isAutoMapping}
        >
          <Wand2 className={`mr-2 h-4 w-4 ${isAutoMapping ? 'animate-spin' : ''}`} />
          {t('import.ai_map')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportDataType)}>
        <TabsList>
          {dataTypes.map(dt => (
            <TabsTrigger key={dt} value={dt} className="capitalize">
              {t(`import.${dt}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {dataTypes.map(dataType => {
          const currentMappings = mappings.get(dataType) || [];
          const targetFields = getTargetFields(dataType);
          const stats = getMappingStats(dataType);

          return (
            <TabsContent key={dataType} value={dataType} className="space-y-4">
              {/* Stats */}
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  {t('import.fields_mapped', { count: stats.mapped })}
                </span>
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  {t('import.fields_skipped', { count: stats.skipped })}
                </span>
              </div>

              {/* Mapping table */}
              <Card className="divide-y">
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 font-medium text-sm">
                  <span>{t('import.source_field')}</span>
                  <span></span>
                  <span>{t('import.target_field')}</span>
                </div>

                {currentMappings.map((mapping) => (
                  <div 
                    key={mapping.sourceField} 
                    className="grid grid-cols-3 gap-4 p-3 items-center"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm truncate">
                        {mapping.sourceField}
                      </span>
                    </div>
                    
                    <div className="text-center text-muted-foreground">→</div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        value={mapping.targetField || 'skip'}
                        onValueChange={(value) => 
                          handleFieldChange(dataType, mapping.sourceField, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Minus className="h-4 w-4" />
                              {t('import.skip')}
                            </span>
                          </SelectItem>
                          {targetFields.map(field => (
                            <SelectItem key={field} value={field}>
                              {field.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {mapping.targetField && mapping.confidence >= 0.8 && (
                        <Badge variant="outline" className="text-green-600 shrink-0">
                          <Check className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
