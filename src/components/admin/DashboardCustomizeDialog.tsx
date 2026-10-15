import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RotateCcw } from 'lucide-react';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import {
  dashboardWidgets,
  layoutPresets,
  type WidgetCategory,
} from '@/config/dashboardWidgets';

interface DashboardCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DashboardCustomizeDialog({
  open,
  onOpenChange,
}: DashboardCustomizeDialogProps) {
  const { t } = useTranslation();
  const {
    layoutType,
    hiddenWidgets,
    updatePreferences,
    isUpdating,
    resetToDefault,
  } = useDashboardPreferences();

  const [localLayout, setLocalLayout] = useState(layoutType);
  const [localHidden, setLocalHidden] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setLocalLayout(layoutType);
      setLocalHidden(hiddenWidgets);
    }
  }, [open, layoutType, hiddenWidgets]);

  const toggleWidget = (widgetId: string) => {
    setLocalHidden((prev) =>
      prev.includes(widgetId)
        ? prev.filter((id) => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const handleSave = () => {
    updatePreferences({
      layout_type: localLayout,
      hidden_widgets: localHidden,
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalLayout('default');
    setLocalHidden([]);
  };

  // Group widgets by category
  const widgetsByCategory = dashboardWidgets.reduce(
    (acc, widget) => {
      if (!acc[widget.category]) acc[widget.category] = [];
      acc[widget.category].push(widget);
      return acc;
    },
    {} as Record<WidgetCategory, typeof dashboardWidgets>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('admin.dashboardWidgets.customize.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.dashboardWidgets.customize.description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Layout Selection */}
            <div>
              <h4 className="text-sm font-medium mb-3">{t('admin.dashboardWidgets.customize.layout')}</h4>
              <RadioGroup
                value={localLayout}
                onValueChange={setLocalLayout}
                className="grid grid-cols-2 gap-2"
              >
                {layoutPresets.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <div key={preset.id}>
                      <RadioGroupItem
                        value={preset.id}
                        id={`layout-${preset.id}`}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={`layout-${preset.id}`}
                        className="flex items-center gap-3 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{t(preset.nameKey)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t(preset.descriptionKey)}
                          </p>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <Separator />

            {/* Widget Selection */}
            <div>
              <h4 className="text-sm font-medium mb-3">{t('admin.dashboardWidgets.customize.widgets')}</h4>
              <div className="space-y-4">
                {(Object.entries(widgetsByCategory) as [WidgetCategory, typeof dashboardWidgets][]).map(
                  ([category, widgets]) => (
                    <div key={category}>
                      <p className="text-xs text-muted-foreground mb-2">
                        {t(`admin.dashboardWidgets.categories.${category}`)}
                      </p>
                      <div className="space-y-2">
                        {widgets.map((widget) => {
                          const Icon = widget.icon;
                          return (
                            <div
                              key={widget.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                            >
                              <Checkbox
                                id={widget.id}
                                checked={!localHidden.includes(widget.id)}
                                onCheckedChange={() => toggleWidget(widget.id)}
                              />
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <Label
                                htmlFor={widget.id}
                                className="flex-1 cursor-pointer"
                              >
                                <span className="text-sm font-normal">
                                  {t(widget.titleKey)}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {t(widget.descriptionKey)}
                                </p>
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('admin.dashboardWidgets.customize.reset')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin.dashboardWidgets.customize.reset_confirm_title')}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    {t('admin.dashboardWidgets.customize.reset_confirm_body')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.dashboardWidgets.customize.reset_confirm_hint')}
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('admin.dashboardWidgets.customize.reset_confirm_action')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            {isUpdating ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
