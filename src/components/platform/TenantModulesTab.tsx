import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Settings2, Save, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { usePlatformAdmin, TenantFeatureOverride } from '@/hooks/usePlatformAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { sidebarGroups, getAllMenuItems } from '@/components/admin/sidebar/sidebarConfig';

interface TenantModulesTabProps {
  tenantId: string;
}

const MODULES = [
  { key: 'module_ai_marketing', label: 'AI Marketing', description: 'AI-gegenereerde content en emails' },
  { key: 'module_peppol', label: 'Peppol', description: 'E-facturatie via Peppol netwerk' },
  { key: 'module_multi_currency', label: 'Multi-Currency', description: 'Ondersteuning meerdere valuta' },
  { key: 'module_advanced_analytics', label: 'Geavanceerde Analytics', description: 'Uitgebreide rapportages' },
  { key: 'module_api_access', label: 'API Toegang', description: 'REST API voor integraties' },
  { key: 'module_webhooks', label: 'Webhooks', description: 'Real-time event notificaties' },
  { key: 'module_white_label', label: 'White Label', description: 'Eigen branding zonder SellQo' },
] as const;

const LIMITS = [
  { key: 'limit_products_override', label: 'Producten', description: 'Max aantal producten' },
  { key: 'limit_orders_override', label: 'Orders', description: 'Max orders per maand' },
  { key: 'limit_customers_override', label: 'Klanten', description: 'Max aantal klanten' },
  { key: 'limit_users_override', label: 'Gebruikers', description: 'Max team members' },
  { key: 'limit_storage_gb_override', label: 'Opslag (GB)', description: 'Max opslag in GB' },
] as const;

export function TenantModulesTab({ tenantId }: TenantModulesTabProps) {
  const { useTenantFeatureOverrides, updateFeatureOverrides } = usePlatformAdmin();
  const { data: overrides, isLoading } = useTenantFeatureOverrides(tenantId);
  
  const [formData, setFormData] = useState<Partial<TenantFeatureOverride>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (overrides) {
      setFormData(overrides);
    }
  }, [overrides]);

  const handleModuleChange = (key: string, value: boolean | null) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleLimitChange = (key: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setFormData((prev) => ({ ...prev, [key]: numValue }));
    setHasChanges(true);
  };

  const handleNotesChange = (value: string) => {
    setFormData((prev) => ({ ...prev, admin_notes: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateFeatureOverrides.mutateAsync({
      tenantId,
      overrides: formData,
    });
    setHasChanges(false);
  };

  const handleReset = () => {
    if (overrides) {
      setFormData(overrides);
    } else {
      setFormData({});
    }
    setHasChanges(false);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={updateFeatureOverrides.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateFeatureOverrides.isPending ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      )}

      {/* Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Module Overrides
          </CardTitle>
          <CardDescription>
            Override module toegang onafhankelijk van het abonnement.
            Leeg = volgt plan instellingen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {MODULES.map((module) => {
              const value = formData[module.key as keyof TenantFeatureOverride] as boolean | null | undefined;
              return (
                <div
                  key={module.key}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{module.label}</p>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {value === null || value === undefined ? 'Auto' : value ? 'Aan' : 'Uit'}
                    </span>
                    <Switch
                      checked={value === true}
                      onCheckedChange={(checked) => handleModuleChange(module.key, checked)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Limiet Overrides</CardTitle>
          <CardDescription>
            Override limieten onafhankelijk van het abonnement.
            Leeg = volgt plan limieten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {LIMITS.map((limit) => {
              const value = formData[limit.key as keyof TenantFeatureOverride] as number | null | undefined;
              return (
                <div key={limit.key} className="space-y-2">
                  <Label htmlFor={limit.key}>{limit.label}</Label>
                  <Input
                    id={limit.key}
                    type="number"
                    placeholder="Auto (plan)"
                    value={value === null || value === undefined ? '' : value}
                    onChange={(e) => handleLimitChange(limit.key, e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{limit.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Page Access Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Pagina Toegang
          </CardTitle>
          <CardDescription>
            Bepaal welke pagina's zichtbaar zijn voor deze tenant.
            Verborgen pagina's worden niet getoond in de sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sidebarGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">{group.title}</h4>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => {
                    const currentHidden = (formData.hidden_pages as string[] | undefined) || [];
                    const isHidden = currentHidden.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          {isHidden ? (
                            <EyeOff className="h-4 w-4 text-destructive/60" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={isHidden ? 'text-muted-foreground line-through' : 'font-medium'}>
                            {item.title}
                          </span>
                        </div>
                        <Switch
                          checked={!isHidden}
                          onCheckedChange={(checked) => {
                            const newHidden = checked
                              ? currentHidden.filter(id => id !== item.id)
                              : [...currentHidden, item.id];
                            setFormData((prev) => ({ ...prev, hidden_pages: newHidden }));
                            setHasChanges(true);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Notities</CardTitle>
          <CardDescription>
            Interne notities over deze tenant (alleen zichtbaar voor platform admins)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Bijv. Enterprise klant, speciale afspraken..."
            value={formData.admin_notes || ''}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}
