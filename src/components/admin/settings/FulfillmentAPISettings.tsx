import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from '@/components/ui/alert-dialog';
import { Key, Plus, Copy, Trash2, Clock, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface FulfillmentAPIKey {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export function FulfillmentAPISettings() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteKey, setDeleteKey] = useState<FulfillmentAPIKey | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Fetch API keys
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['fulfillment-api-keys', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('fulfillment_api_keys')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FulfillmentAPIKey[];
    },
    enabled: !!currentTenant?.id,
  });

  // Create API key
  const createKey = useMutation({
    mutationFn: async (name: string) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Generate API key using database function
      const { data: keyData, error: keyError } = await supabase
        .rpc('generate_fulfillment_api_key');

      if (keyError) throw keyError;

      const { data, error } = await supabase
        .from('fulfillment_api_keys')
        .insert({
          tenant_id: currentTenant.id,
          name,
          api_key: keyData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-api-keys'] });
      setNewKeyName('');
      setNewlyCreatedKey(data.api_key);
      toast({
        title: 'API Key aangemaakt',
        description: 'Kopieer de key nu - deze wordt niet meer getoond.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle key active state
  const toggleKey = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('fulfillment_api_keys')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-api-keys'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete API key
  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fulfillment_api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-api-keys'] });
      setDeleteKey(null);
      toast({
        title: 'API Key verwijderd',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Gekopieerd',
      description: 'API key is gekopieerd naar klembord',
    });
  };

  const maskKey = (key: string) => {
    return key.substring(0, 12) + '...' + key.substring(key.length - 4);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Fulfillment API Keys
        </CardTitle>
        <CardDescription>
          Beheer API keys voor externe fulfillment partners (3PL, dropshipping)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !apiKeys || apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nog geen API keys aangemaakt</p>
            <p className="text-sm">Maak een key aan om externe partners toegang te geven</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.name}</span>
                    {key.is_active ? (
                      <Badge variant="default" className="bg-green-500">Actief</Badge>
                    ) : (
                      <Badge variant="secondary">Inactief</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <code className="bg-muted px-2 py-0.5 rounded">{maskKey(key.api_key)}</code>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {key.last_used_at
                        ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true, locale: nl })
                        : 'Nooit gebruikt'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={key.is_active}
                    onCheckedChange={(checked) => toggleKey.mutate({ id: key.id, isActive: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(key.api_key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteKey(key)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Key Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setNewlyCreatedKey(null);
            setNewKeyName('');
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuwe Fulfillment API Key</DialogTitle>
              <DialogDescription>
                Maak een API key aan voor een externe fulfillment partner
              </DialogDescription>
            </DialogHeader>
            
            {newlyCreatedKey ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">API Key aangemaakt!</span>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    Kopieer deze key nu - deze wordt niet meer getoond:
                  </p>
                  <code className="block p-2 bg-background rounded border text-sm break-all">
                    {newlyCreatedKey}
                  </code>
                </div>
                <Button
                  className="w-full"
                  onClick={() => copyToClipboard(newlyCreatedKey)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Kopieer naar klembord
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Naam</Label>
                    <Input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Bijv. CJ Dropshipping"
                    />
                    <p className="text-xs text-muted-foreground">
                      Geef een herkenbare naam voor deze partner
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Annuleren
                  </Button>
                  <Button
                    onClick={() => createKey.mutate(newKeyName)}
                    disabled={!newKeyName || createKey.isPending}
                  >
                    Aanmaken
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteKey} onOpenChange={(open) => !open && setDeleteKey(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>API Key verwijderen?</AlertDialogTitle>
              <AlertDialogDescription>
                Weet je zeker dat je de API key "{deleteKey?.name}" wilt verwijderen?
                Externe systemen die deze key gebruiken zullen geen toegang meer hebben.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteKey && deleteKeyMutation.mutate(deleteKey.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Verwijderen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* API Documentation */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            <strong>API Endpoints:</strong>
          </p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
            <li><code>GET /functions/v1/fulfillment-api/orders</code> - Haal te verzenden orders op</li>
            <li><code>POST /functions/v1/fulfillment-api/orders/:id/tracking</code> - Update tracking info</li>
            <li><code>POST /functions/v1/fulfillment-api/orders/:id/shipped</code> - Markeer als verzonden</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
