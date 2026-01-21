import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Save, Loader2 } from 'lucide-react';
import { useStorefront } from '@/hooks/useStorefront';
import { toast } from 'sonner';
import {
  REVIEW_PLATFORMS,
  WIDGET_POSITION_OPTIONS,
  FLOATING_STYLE_OPTIONS,
  MIN_RATING_OPTIONS,
  type ReviewPlatform,
} from '@/types/reviews-hub';

export function ReviewsHubSettings() {
  const { themeSettings, saveThemeSettings } = useStorefront();
  
  const [formData, setFormData] = useState({
    reviews_hub_enabled: false,
    reviews_display_platforms: ['google', 'trustpilot', 'kiyoh'] as ReviewPlatform[],
    reviews_aggregate_display: true,
    reviews_widget_position: 'none' as string,
    reviews_floating_style: 'badge' as string,
    reviews_min_rating_filter: 1,
    reviews_homepage_section: false,
    reviews_trust_bar_enabled: false,
    reviews_auto_feature_threshold: 5,
  });

  useEffect(() => {
    if (themeSettings) {
      const settings = themeSettings as any;
      setFormData({
        reviews_hub_enabled: settings.reviews_hub_enabled ?? false,
        reviews_display_platforms: settings.reviews_display_platforms ?? ['google', 'trustpilot', 'kiyoh'],
        reviews_aggregate_display: settings.reviews_aggregate_display ?? true,
        reviews_widget_position: settings.reviews_widget_position ?? 'none',
        reviews_floating_style: settings.reviews_floating_style ?? 'badge',
        reviews_min_rating_filter: settings.reviews_min_rating_filter ?? 1,
        reviews_homepage_section: settings.reviews_homepage_section ?? false,
        reviews_trust_bar_enabled: settings.reviews_trust_bar_enabled ?? false,
        reviews_auto_feature_threshold: settings.reviews_auto_feature_threshold ?? 5,
      });
    }
  }, [themeSettings]);

  const handleSave = () => {
    saveThemeSettings.mutate(formData as any, {
      onSuccess: () => {
        toast.success('Reviews instellingen opgeslagen');
      },
    });
  };

  const togglePlatform = (platform: ReviewPlatform) => {
    setFormData(prev => {
      const platforms = prev.reviews_display_platforms;
      if (platforms.includes(platform)) {
        return { ...prev, reviews_display_platforms: platforms.filter(p => p !== platform) };
      } else {
        return { ...prev, reviews_display_platforms: [...platforms, platform] };
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Main Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Reviews Hub</CardTitle>
              <CardDescription>
                Toon externe reviews op je webshop
              </CardDescription>
            </div>
            <Switch
              checked={formData.reviews_hub_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reviews_hub_enabled: checked }))}
            />
          </div>
        </CardHeader>
      </Card>

      {formData.reviews_hub_enabled && (
        <>
          {/* Platform Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Platformen Weergeven</CardTitle>
              <CardDescription>
                Selecteer welke review platformen zichtbaar zijn voor bezoekers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {REVIEW_PLATFORMS.map(platform => (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      formData.reviews_display_platforms.includes(platform.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: platform.bgColor }}
                    >
                      <img 
                        src={platform.logo} 
                        alt={platform.name}
                        className="w-5 h-5"
                      />
                    </div>
                    <span className="text-sm font-medium">{platform.name}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Weergave Instellingen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Aggregate Display */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Gecombineerde Score</Label>
                  <p className="text-sm text-muted-foreground">
                    Toon één gemiddelde score van alle platformen
                  </p>
                </div>
                <Switch
                  checked={formData.reviews_aggregate_display}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reviews_aggregate_display: checked }))}
                />
              </div>

              {/* Widget Position */}
              <div className="space-y-2">
                <Label>Widget Positie</Label>
                <Select
                  value={formData.reviews_widget_position}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, reviews_widget_position: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDGET_POSITION_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Floating Style - Only show when floating is selected */}
              {formData.reviews_widget_position === 'floating' && (
                <div className="space-y-2">
                  <Label>Floating Widget Stijl</Label>
                  <Select
                    value={formData.reviews_floating_style}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, reviews_floating_style: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOATING_STYLE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Min Rating Filter */}
              <div className="space-y-2">
                <Label>Minimale Rating</Label>
                <Select
                  value={formData.reviews_min_rating_filter.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, reviews_min_rating_filter: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MIN_RATING_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Trust Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Trust Bar in Header</Label>
                  <p className="text-sm text-muted-foreground">
                    Toon platform badges boven de header
                  </p>
                </div>
                <Switch
                  checked={formData.reviews_trust_bar_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reviews_trust_bar_enabled: checked }))}
                />
              </div>

              {/* Homepage Section */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Homepage Sectie</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatisch reviews tonen op homepage
                  </p>
                </div>
                <Switch
                  checked={formData.reviews_homepage_section}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reviews_homepage_section: checked }))}
                />
              </div>

              {/* Auto Feature Threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Auto-uitlichten</Label>
                  <span className="text-sm text-muted-foreground">
                    {formData.reviews_auto_feature_threshold} sterren
                  </span>
                </div>
                <Slider
                  value={[formData.reviews_auto_feature_threshold]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, reviews_auto_feature_threshold: value }))}
                  min={3}
                  max={5}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Reviews met {formData.reviews_auto_feature_threshold}+ sterren worden automatisch uitgelicht
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveThemeSettings.isPending}>
              {saveThemeSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Opslaan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
