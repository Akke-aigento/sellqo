import { useState, useMemo } from 'react';
import { Mail, MessageSquare, Send, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomers } from '@/hooks/useCustomers';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

type ComposeChannel = 'email' | 'whatsapp';

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export function ComposeDialog({ open, onOpenChange, onSent }: ComposeDialogProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [channel, setChannel] = useState<ComposeChannel>('email');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null>(null);
  const [manualRecipient, setManualRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const { customers, isLoading: isSearching } = useCustomers(
    recipientSearch.length >= 2 ? recipientSearch : undefined
  );

  const filteredCustomers = useMemo(() => {
    if (recipientSearch.length < 2) return [];
    return customers.slice(0, 8);
  }, [customers, recipientSearch]);

  const canSendWhatsApp = currentTenant?.whatsapp_enabled;

  const recipientDisplay = selectedCustomer
    ? `${selectedCustomer.name} (${channel === 'whatsapp' ? selectedCustomer.phone : selectedCustomer.email})`
    : manualRecipient;

  const canSend = () => {
    if (!message.trim()) return false;
    if (channel === 'email') {
      if (!subject.trim()) return false;
      const email = selectedCustomer?.email || manualRecipient;
      return !!email && email.includes('@');
    }
    if (channel === 'whatsapp') {
      const phone = selectedCustomer?.phone || manualRecipient;
      return !!phone && phone.length >= 8;
    }
    return false;
  };

  const handleSelectCustomer = (customer: typeof customers[0]) => {
    setSelectedCustomer({
      id: customer.id,
      name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email,
      email: customer.email,
      phone: customer.phone || undefined,
    });
    setRecipientSearch('');
    setManualRecipient('');
    setShowResults(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setManualRecipient('');
  };

  const handleSend = async () => {
    if (!currentTenant?.id || !canSend()) return;

    setIsSending(true);
    try {
      if (channel === 'email') {
        const toEmail = selectedCustomer?.email || manualRecipient;
        const toName = selectedCustomer?.name || manualRecipient;

        const { error } = await supabase.functions.invoke('send-customer-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_email: toEmail,
            customer_name: toName,
            subject: subject.trim(),
            body_html: message.trim().replace(/\n/g, '<br>'),
            body_text: message.trim(),
            context_type: 'general',
            customer_id: selectedCustomer?.id,
          },
        });
        if (error) throw error;
      } else {
        const toPhone = selectedCustomer?.phone || manualRecipient;

        const { error } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_id: selectedCustomer?.id,
            to_phone: toPhone,
            message: message.trim(),
            template_type: 'custom',
          },
        });
        if (error) throw error;
      }

      toast({
        title: 'Bericht verzonden',
        description: `Nieuw ${channel === 'email' ? 'e-mail' : 'WhatsApp'} bericht is verstuurd.`,
      });

      // Reset form
      setChannel('email');
      setSelectedCustomer(null);
      setManualRecipient('');
      setRecipientSearch('');
      setSubject('');
      setMessage('');

      // Refresh inbox
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      onOpenChange(false);
      onSent?.();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Verzenden mislukt',
        description: error.message || 'Er is iets misgegaan.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nieuw bericht</DialogTitle>
          <DialogDescription>
            Start een nieuw gesprek met een klant via e-mail of WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel selector */}
          <div>
            <Label className="text-sm font-medium">Kanaal</Label>
            <Tabs value={channel} onValueChange={(v) => setChannel(v as ComposeChannel)} className="mt-1.5">
              <TabsList className="h-9">
                <TabsTrigger value="email" className="text-xs px-4 h-7">
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email
                </TabsTrigger>
                {canSendWhatsApp && (
                  <TabsTrigger value="whatsapp" className="text-xs px-4 h-7">
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    WhatsApp
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>

          {/* Recipient */}
          <div>
            <Label className="text-sm font-medium">
              {channel === 'email' ? 'Ontvanger (e-mail)' : 'Ontvanger (telefoonnummer)'}
            </Label>
            {selectedCustomer ? (
              <div className="mt-1.5 flex items-center gap-2 bg-muted rounded-md px-3 py-2 text-sm">
                <span className="flex-1 truncate">{recipientDisplay}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleClearCustomer}
                >
                  Wijzig
                </Button>
              </div>
            ) : (
              <div className="mt-1.5 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={channel === 'email' ? 'Zoek klant of typ e-mailadres...' : 'Zoek klant of typ telefoonnummer...'}
                  className="pl-8"
                  value={recipientSearch || manualRecipient}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRecipientSearch(val);
                    setManualRecipient(val);
                    setShowResults(val.length >= 2);
                  }}
                  onFocus={() => {
                    if (recipientSearch.length >= 2) setShowResults(true);
                  }}
                  onBlur={() => {
                    // Delay to allow click on result
                    setTimeout(() => setShowResults(false), 200);
                  }}
                />
                {/* Customer search results */}
                {showResults && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md">
                    <ScrollArea className="max-h-48">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectCustomer(c);
                          }}
                        >
                          <div className="font-medium">
                            {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.email}
                            {c.phone && ` · ${c.phone}`}
                          </div>
                        </button>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div>
              <Label className="text-sm font-medium">Onderwerp</Label>
              <Input
                className="mt-1.5"
                placeholder="Onderwerp van je bericht..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          {/* Message body */}
          <div>
            <Label className="text-sm font-medium">Bericht</Label>
            <Textarea
              className="mt-1.5 min-h-[120px] resize-y"
              placeholder="Typ je bericht..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSend();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cmd+Enter om te verzenden
            </p>
          </div>

          {/* Send button */}
          <div className="flex justify-end">
            <Button onClick={handleSend} disabled={!canSend() || isSending}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Verzenden...' : 'Verzenden'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
