import { useState } from 'react';
import { Key, Plus, Copy, Check, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

export function StorefrontApiKeysManager() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newFullKey, setNewFullKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['storefront-api-keys', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('storefront_api_keys')
        .select('id, key_prefix, name, is_active, created_at, last_used_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke('generate-storefront-api-key', {
        body: { tenant_id: currentTenant!.id, name },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setNewFullKey(data.full_key);
      setKeyName('');
      queryClient.invalidateQueries({ queryKey: ['storefront-api-keys'] });
      toast.success('API key aangemaakt');
    },
    onError: (err: Error) => {
      toast.error(`Fout bij aanmaken: ${err.message}`);
    },
  });

  const toggleKey = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('storefront_api_keys')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-api-keys'] });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('storefront_api_keys')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-api-keys'] });
      toast.success('API key verwijderd');
    },
  });

  const copyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Gekopieerd');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    if (!keyName.trim()) {
      toast.error('Geef de key een naam');
      return;
    }
    createKey.mutate(keyName.trim());
  };

  const handleCloseDialog = () => {
    setCreateOpen(false);
    setNewFullKey(null);
    setKeyName('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Beheer API keys voor je custom frontend
            </CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setCreateOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nieuwe Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              {newFullKey ? (
                <>
                  <DialogHeader>
                    <DialogTitle>API Key Aangemaakt</DialogTitle>
                    <DialogDescription>
                      Kopieer deze key nu. Hij wordt slechts éénmaal getoond.
                    </DialogDescription>
                  </DialogHeader>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Bewaar deze key veilig. Na het sluiten van dit venster kan je hem niet meer inzien.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-2">
                    <Input value={newFullKey} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyKey(newFullKey)}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseDialog}>Sluiten</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Nieuwe API Key</DialogTitle>
                    <DialogDescription>
                      Geef je key een herkenbare naam (bijv. "Production" of "Staging")
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label>Naam</Label>
                    <Input
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="Production"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseDialog}>Annuleren</Button>
                    <Button onClick={handleCreate} disabled={createKey.isPending}>
                      {createKey.isPending ? 'Aanmaken...' : 'Aanmaken'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen API keys aangemaakt.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{key.name || 'Naamloos'}</span>
                    <Badge variant={key.is_active ? 'default' : 'secondary'}>
                      {key.is_active ? 'Actief' : 'Inactief'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-xs text-muted-foreground">{key.key_prefix}••••••••</code>
                    <span className="text-xs text-muted-foreground">
                      Aangemaakt {format(new Date(key.created_at!), 'd MMM yyyy', { locale: nl })}
                    </span>
                    {key.last_used_at && (
                      <span className="text-xs text-muted-foreground">
                        Laatst gebruikt {format(new Date(key.last_used_at), 'd MMM yyyy', { locale: nl })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={key.is_active ?? true}
                    onCheckedChange={(checked) => toggleKey.mutate({ id: key.id, is_active: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('Weet je zeker dat je deze key wilt verwijderen?')) {
                        deleteKey.mutate(key.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
