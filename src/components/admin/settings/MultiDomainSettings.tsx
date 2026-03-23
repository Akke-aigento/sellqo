import { useState } from 'react';
import { Globe, Plus, Trash2, Crown, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useTenantDomains, type TenantDomain } from '@/hooks/useTenantDomains';
import { TRANSLATION_LANGUAGES } from '@/types/translation';
import { DomainVerificationPanel } from './DomainVerificationPanel';
import { useStorefront } from '@/hooks/useStorefront';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function MultiDomainSettings() {
  const { domains, isLoading, addDomain, updateDomain, removeDomain } = useTenantDomains();
  const { themeSettings } = useStorefront();
  const isMobile = useIsMobile();
  const useCustomFrontend = (themeSettings as any)?.use_custom_frontend;
  const customFrontendUrl = (themeSettings as any)?.custom_frontend_url;
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newLocale, setNewLocale] = useState('nl');
  const [newCanonical, setNewCanonical] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLocale, setEditLocale] = useState('');

  const isExternalHosting = !!useCustomFrontend;

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    await addDomain.mutateAsync({
      domain: newDomain,
      locale: newLocale,
      is_canonical: newCanonical || domains.length === 0,
      hosting_mode: isExternalHosting ? 'external' : 'sellqo',
    });
    setNewDomain('');
    setNewLocale('nl');
    setNewCanonical(false);
    setShowAddForm(false);
  };

  const handleSetCanonical = (domainId: string) => {
    updateDomain.mutate({ id: domainId, updates: { is_canonical: true } });
  };

  const handleToggleActive = (domain: TenantDomain) => {
    updateDomain.mutate({ id: domain.id, updates: { is_active: !domain.is_active } });
  };

  const handleSaveLocale = (domainId: string) => {
    updateDomain.mutate({ id: domainId, updates: { locale: editLocale } });
    setEditingId(null);
  };

  const startEditLocale = (domain: TenantDomain) => {
    setEditingId(domain.id);
    setEditLocale(domain.locale);
  };

  const getLocaleLabel = (code: string) => {
    const lang = TRANSLATION_LANGUAGES.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.label}` : code;
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Domeinen
            </CardTitle>
            <CardDescription>
              Koppel meerdere domeinen aan je webshop, elk met een eigen taalinstelling
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddForm(true)} size="sm" disabled={showAddForm} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" />
            Domein toevoegen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Custom Frontend info alert */}
        {useCustomFrontend && domains.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Custom frontend actief — domeinen worden extern gehost. Koppel ze aan je custom frontend project (bijv. via Lovable Domains).
              {customFrontendUrl && <> Frontend URL: <strong>{customFrontendUrl}</strong></>}
            </AlertDescription>
          </Alert>
        )}

        {showAddForm && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Domein</Label>
                  <Input
                    placeholder="voorbeeld.nl"
                    value={newDomain}
                    onChange={e => setNewDomain(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taal</Label>
                  <Select value={newLocale} onValueChange={setNewLocale}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRANSLATION_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Canonical (SEO)</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={newCanonical || domains.length === 0}
                      onCheckedChange={setNewCanonical}
                      disabled={domains.length === 0}
                    />
                    <span className="text-sm text-muted-foreground">Hoofddomein</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  Annuleren
                </Button>
                <Button size="sm" onClick={handleAdd} disabled={addDomain.isPending || !newDomain.trim()}>
                  Toevoegen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : domains.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nog geen domeinen gekoppeld</p>
            <p className="text-sm">Voeg je eerste domein toe om te beginnen</p>
          </div>
        ) : isMobile ? (
          /* Mobile: Card-based list */
          <div className="space-y-3">
            {domains.map(domain => (
              <div key={domain.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{domain.domain}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {domain.is_canonical && (
                        <Badge variant="default" className="text-xs gap-1">
                          <Crown className="h-3 w-3" />
                          Canonical
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {useCustomFrontend ? 'Custom Frontend' : 'SellQo Theme'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!domain.is_canonical && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetCanonical(domain.id)} title="Instellen als canonical">
                        <Crown className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Domein verwijderen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Weet je zeker dat je {domain.domain} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuleren</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeDomain.mutate(domain.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Verwijderen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    {editingId === domain.id ? (
                      <div className="flex items-center gap-1">
                        <Select value={editLocale} onValueChange={setEditLocale}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TRANSLATION_LANGUAGES.map(lang => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.flag} {lang.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSaveLocale(domain.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button onClick={() => startEditLocale(domain)} className="flex items-center gap-1 hover:underline">
                        {getLocaleLabel(domain.locale)}
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {domain.hosting_mode !== 'external' && <DomainVerificationPanel domain={domain} />}
                    {domain.hosting_mode === 'external' && (
                      <Badge variant="outline" className="text-xs">Extern</Badge>
                    )}
                    <Switch
                      checked={domain.is_active}
                      onCheckedChange={() => handleToggleActive(domain)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domein</TableHead>
                <TableHead>Taal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actief</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map(domain => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {domain.domain}
                      {domain.is_canonical && (
                        <Badge variant="default" className="text-xs gap-1">
                          <Crown className="h-3 w-3" />
                          Canonical
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {useCustomFrontend ? 'Custom Frontend' : 'SellQo Theme'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingId === domain.id ? (
                      <div className="flex items-center gap-1">
                        <Select value={editLocale} onValueChange={setEditLocale}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TRANSLATION_LANGUAGES.map(lang => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.flag} {lang.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSaveLocale(domain.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button onClick={() => startEditLocale(domain)} className="flex items-center gap-1 hover:underline text-sm">
                        {getLocaleLabel(domain.locale)}
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <DomainVerificationPanel domain={domain} />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={domain.is_active}
                      onCheckedChange={() => handleToggleActive(domain)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {!domain.is_canonical && (
                        <Button variant="ghost" size="sm" onClick={() => handleSetCanonical(domain.id)} title="Instellen als canonical">
                          <Crown className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Domein verwijderen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet je zeker dat je {domain.domain} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeDomain.mutate(domain.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Verwijderen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
