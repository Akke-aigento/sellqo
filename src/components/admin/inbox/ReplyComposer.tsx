import { useState } from 'react';
import { Send, Paperclip, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation } from '@/hooks/useInbox';

interface ReplyComposerProps {
  conversation: Conversation;
  onSent: () => void;
}

export function ReplyComposer({ conversation, onSent }: ReplyComposerProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp'>(
    conversation.channel === 'whatsapp' ? 'whatsapp' : 'email'
  );
  const [isSending, setIsSending] = useState(false);

  const canSendWhatsApp = conversation.customer?.phone && currentTenant?.whatsapp_enabled;
  const canSendEmail = !!conversation.customer?.email;

  const handleSend = async () => {
    if (!message.trim() || !currentTenant?.id) return;

    setIsSending(true);
    try {
      if (channel === 'whatsapp') {
        const { error } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_id: conversation.customer?.id,
            to_phone: conversation.customer?.phone,
            message: message.trim(),
            template_type: 'custom',
          },
        });
        if (error) throw error;
      } else {
        // Send via email
        const { error } = await supabase.functions.invoke('send-customer-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_email: conversation.customer?.email,
            customer_name: conversation.customer?.name,
            subject: `Re: ${conversation.lastMessage.subject || 'Uw bericht'}`,
            body_html: message.trim().replace(/\n/g, '<br>'),
            body_text: message.trim(),
            context_type: 'general',
            customer_id: conversation.customer?.id,
          },
        });
        if (error) throw error;
      }

      toast({
        title: 'Bericht verzonden',
        description: `Antwoord verstuurd via ${channel === 'whatsapp' ? 'WhatsApp' : 'email'}.`,
      });

      setMessage('');
      onSent();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Verzenden mislukt',
        description: 'Er is iets misgegaan bij het verzenden.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border-t p-4 bg-background">
      {/* Channel selector */}
      {(canSendWhatsApp || conversation.channel === 'mixed') && (
        <Tabs value={channel} onValueChange={(v) => setChannel(v as 'email' | 'whatsapp')} className="mb-3">
          <TabsList className="h-8">
            {canSendEmail && (
              <TabsTrigger value="email" className="text-xs px-3 h-7">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </TabsTrigger>
            )}
            {canSendWhatsApp && (
              <TabsTrigger value="whatsapp" className="text-xs px-3 h-7">
                <MessageSquare className="h-3 w-3 mr-1" />
                WhatsApp
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      )}

      {/* Message input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            placeholder="Typ je antwoord..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[80px] resize-none pr-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSend();
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 bottom-1 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
          className="h-auto self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Druk op Cmd+Enter om te verzenden
      </p>
    </div>
  );
}
