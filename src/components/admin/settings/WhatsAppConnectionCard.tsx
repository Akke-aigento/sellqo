import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Phone, RefreshCw, Unlink, CheckCircle2, AlertCircle, Link2 } from 'lucide-react';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { cn } from '@/lib/utils';

export function WhatsAppConnectionCard() {
  const { connection, isLoading, isConnected, connectWhatsApp, disconnectWhatsApp, refetch } = useWhatsAppConnection();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    phone_number_id: '',
    business_account_id: '',
    display_phone_number: '',
    verified_name: '',
    access_token: '',
  });

  const handleConnect = async () => {
    await connectWhatsApp.mutateAsync(formData);
    setConnectDialogOpen(false);
    setFormData({
      phone_number_id: '',
      business_account_id: '',
      display_phone_number: '',
      verified_name: '',
      access_token: '',
    });
  };

  const getQualityBadge = (rating: string | null) => {
    switch (rating) {
      case 'GREEN':
        return <Badge className="bg-emerald-500">Uitstekend</Badge>;
      case 'YELLOW':
        return <Badge className="bg-yellow-500">Matig</Badge>;
      case 'RED':
        return <Badge variant="destructive">Laag</Badge>;
      default:
        return <Badge variant="secondary">Onbekend</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Verbinding
        </CardTitle>
        <CardDescription>
          Koppel je WhatsApp Business account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected && connection ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Verbonden</span>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Telefoonnummer</span>
                <span className="font-medium">{connection.display_phone_number}</span>
              </div>
              {connection.verified_name && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Bedrijfsnaam</span>
                  <span className="font-medium">{connection.verified_name}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Kwaliteitsscore</span>
                {getQualityBadge(connection.quality_rating)}
              </div>
              {connection.messaging_limit && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Berichtenlimiet</span>
                  <Badge variant="outline">{connection.messaging_limit}</Badge>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Vernieuwen
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => disconnectWhatsApp.mutate()}
                disabled={disconnectWhatsApp.isPending}
              >
                <Unlink className="h-4 w-4 mr-2" />
                Ontkoppelen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground">Geen WhatsApp account gekoppeld</span>
            </div>

            <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Link2 className="h-4 w-4 mr-2" />
                  WhatsApp koppelen
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>WhatsApp Business koppelen</DialogTitle>
                  <DialogDescription>
                    Vul je WhatsApp Business API gegevens in. Je vindt deze in het Meta Business Platform.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone_number_id">Phone Number ID</Label>
                    <Input
                      id="phone_number_id"
                      placeholder="123456789012345"
                      value={formData.phone_number_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone_number_id: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_account_id">Business Account ID</Label>
                    <Input
                      id="business_account_id"
                      placeholder="123456789012345"
                      value={formData.business_account_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, business_account_id: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_phone_number">Telefoonnummer</Label>
                    <Input
                      id="display_phone_number"
                      placeholder="+31 6 12345678"
                      value={formData.display_phone_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_phone_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verified_name">Bedrijfsnaam (optioneel)</Label>
                    <Input
                      id="verified_name"
                      placeholder="Mijn Webshop B.V."
                      value={formData.verified_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, verified_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="access_token">Access Token</Label>
                    <Input
                      id="access_token"
                      type="password"
                      placeholder="EAAx..."
                      value={formData.access_token}
                      onChange={(e) => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button 
                    onClick={handleConnect}
                    disabled={!formData.phone_number_id || !formData.business_account_id || !formData.display_phone_number || !formData.access_token || connectWhatsApp.isPending}
                  >
                    {connectWhatsApp.isPending ? 'Koppelen...' : 'Koppelen'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
