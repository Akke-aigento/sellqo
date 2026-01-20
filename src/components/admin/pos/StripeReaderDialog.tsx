import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStripeTerminal } from '@/hooks/useStripeTerminal';
import { Loader2, CreditCard, Trash2, Plus, RefreshCw } from 'lucide-react';

interface StripeReaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReaderSelect?: (readerId: string) => void;
}

export function StripeReaderDialog({
  open,
  onOpenChange,
  onReaderSelect,
}: StripeReaderDialogProps) {
  const {
    readers,
    listReaders,
    registerReader,
    deleteReader,
    isProcessing,
  } = useStripeTerminal();

  const [isLoading, setIsLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registrationCode, setRegistrationCode] = useState('');
  const [readerLabel, setReaderLabel] = useState('');

  useEffect(() => {
    if (open) {
      loadReaders();
    }
  }, [open]);

  const loadReaders = async () => {
    setIsLoading(true);
    try {
      await listReaders();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registrationCode || !readerLabel) return;

    try {
      await registerReader(registrationCode, readerLabel);
      setShowRegister(false);
      setRegistrationCode('');
      setReaderLabel('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async (readerId: string) => {
    if (confirm('Weet je zeker dat je deze reader wilt verwijderen?')) {
      await deleteReader(readerId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500">Online</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Terminal Readers
          </DialogTitle>
          <DialogDescription>
            Beheer je pinautomaten voor kaartbetalingen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReaders}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Vernieuwen
            </Button>
            <Button
              size="sm"
              onClick={() => setShowRegister(!showRegister)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Reader toevoegen
            </Button>
          </div>

          {showRegister && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nieuwe reader registreren</CardTitle>
                <CardDescription>
                  Voer de registratiecode in die op het scherm van de reader staat
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="registration-code">Registratiecode</Label>
                  <Input
                    id="registration-code"
                    placeholder="bijv. seagull-local-apple"
                    value={registrationCode}
                    onChange={(e) => setRegistrationCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reader-label">Label</Label>
                  <Input
                    id="reader-label"
                    placeholder="bijv. Kassa 1"
                    value={readerLabel}
                    onChange={(e) => setReaderLabel(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRegister}
                    disabled={isProcessing || !registrationCode || !readerLabel}
                  >
                    {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Registreren
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRegister(false)}
                  >
                    Annuleren
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : readers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Geen readers gevonden</p>
              <p className="text-sm">Registreer een Stripe Terminal reader om kaartbetalingen te accepteren</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {readers.map((reader) => (
                <Card key={reader.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1"
                        onClick={() => {
                          onReaderSelect?.(reader.id);
                          onOpenChange(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{reader.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {reader.device_type} • {reader.serial_number}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(reader.status)}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(reader.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
