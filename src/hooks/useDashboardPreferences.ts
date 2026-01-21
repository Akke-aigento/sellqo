import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { defaultWidgetOrder, getLayoutPresetById } from '@/config/dashboardWidgets';

export interface DashboardPreferences {
  id: string;
  user_id: string;
  tenant_id: string;
  layout_type: string;
  widget_order: string[];
  hidden_widgets: string[];
  widget_sizes: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface DashboardPreferencesUpdate {
  layout_type?: string;
  widget_order?: string[];
  hidden_widgets?: string[];
  widget_sizes?: Record<string, string>;
}

export function useDashboardPreferences() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const queryKey = ['dashboard-preferences', user?.id, currentTenant?.id];

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<DashboardPreferences | null> => {
      if (!user?.id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      
      // Transform data to match our interface
      if (data) {
        return {
          ...data,
          widget_order: Array.isArray(data.widget_order) 
            ? (data.widget_order as unknown as string[]) 
            : [],
          widget_sizes: typeof data.widget_sizes === 'object' && data.widget_sizes !== null 
            ? data.widget_sizes as Record<string, string>
            : {},
        };
      }
      
      return null;
    },
    enabled: !!user?.id && !!currentTenant?.id,
  });

  // Update preferences mutation
  const updatePreferences = useMutation({
    mutationFn: async (updates: DashboardPreferencesUpdate) => {
      if (!user?.id || !currentTenant?.id) {
        throw new Error('User or tenant not available');
      }

      const { error } = await supabase
        .from('dashboard_preferences')
        .upsert(
          {
            user_id: user.id,
            tenant_id: currentTenant.id,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,tenant_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Get current layout type
  const layoutType = preferences?.layout_type || 'default';

  // Get widget order (use preset if no custom order)
  const widgetOrder = (): string[] => {
    if (preferences?.widget_order && preferences.widget_order.length > 0) {
      return preferences.widget_order;
    }
    const preset = getLayoutPresetById(layoutType);
    return preset?.widgetOrder || defaultWidgetOrder;
  };

  // Get hidden widgets
  const hiddenWidgets = (): string[] => {
    if (preferences?.hidden_widgets && preferences.hidden_widgets.length > 0) {
      return preferences.hidden_widgets;
    }
    const preset = getLayoutPresetById(layoutType);
    return preset?.hiddenWidgets || [];
  };

  // Check if a widget is visible
  const isWidgetVisible = (widgetId: string): boolean => {
    return !hiddenWidgets().includes(widgetId);
  };

  // Set layout type (applies preset)
  const setLayout = (newLayoutType: string) => {
    const preset = getLayoutPresetById(newLayoutType);
    if (preset) {
      updatePreferences.mutate({
        layout_type: newLayoutType,
        widget_order: preset.widgetOrder,
        hidden_widgets: preset.hiddenWidgets,
      });
    }
  };

  // Toggle widget visibility
  const toggleWidget = (widgetId: string) => {
    const current = hiddenWidgets();
    const newHidden = current.includes(widgetId)
      ? current.filter((id) => id !== widgetId)
      : [...current, widgetId];
    
    updatePreferences.mutate({ hidden_widgets: newHidden });
  };

  // Update widget order
  const updateWidgetOrder = (newOrder: string[]) => {
    updatePreferences.mutate({ widget_order: newOrder });
  };

  // Show all widgets
  const showAllWidgets = () => {
    updatePreferences.mutate({ hidden_widgets: [] });
  };

  // Reset to default layout
  const resetToDefault = () => {
    updatePreferences.mutate({
      layout_type: 'default',
      widget_order: defaultWidgetOrder,
      hidden_widgets: [],
      widget_sizes: {},
    });
  };

  return {
    preferences,
    isLoading,
    layoutType,
    widgetOrder: widgetOrder(),
    hiddenWidgets: hiddenWidgets(),
    isWidgetVisible,
    setLayout,
    toggleWidget,
    updateWidgetOrder,
    showAllWidgets,
    resetToDefault,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
}
