import { useState, useEffect } from 'react';
import { Send, Paperclip, Mail, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { useAISuggestion } from '@/hooks/useAISuggestion';
import { AISuggestionBox } from './AISuggestionBox';
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

  // AI Suggestion integration
  const { config: aiConfig } = useAIAssistant();
  const { suggestion, isLoading: isSuggestionLoading, fetchSuggestion, clearSuggestion } = useAISuggestion();

  const canSendWhatsApp = conversation.customer?.phone && currentTenant?.whatsapp_enabled;
  const canSendEmail = !!conversation.customer?.email;

  // Check if AI suggestions are enabled for this channel
  const shouldShowAISuggestion = aiConfig?.reply_suggestions_enabled && (
    (channel === 'email' && aiConfig.reply_suggestions_for_email) ||
    (channel === 'whatsapp' && aiConfig.reply_suggestions_for_whatsapp)
  );

  // Fetch AI suggestion when conversation changes (only if enabled)
  useEffect(() => {
    const messageContent = conversation.lastMessage?.body_text || conversation.lastMessage?.body_html?.replace(/<[^>]*>/g, '');
    if (shouldShowAISuggestion && messageContent && !suggestion) {
      const lastMessage = conversation.lastMessage;
      // Only fetch if the last message is from the customer
      if (lastMessage?.direction === 'inbound') {
        fetchSuggestion({
          conversationId: conversation.id,
          customerMessage: messageContent,
          customerName: conversation.customer?.name,
          channel,
          context: {
            orderId: lastMessage.order_id || undefined,
            subject: lastMessage.subject || undefined,
          },
        });
      }
    }
  }, [conversation.id, shouldShowAISuggestion]);

  // Auto-fill suggestion if auto_draft is enabled
  useEffect(() => {
    if (suggestion && aiConfig?.reply_suggestions_auto_draft && !message) {
      setMessage(suggestion);
      clearSuggestion();
    }
  }, [suggestion, aiConfig?.reply_suggestions_auto_draft]);

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      setMessage(suggestion);
      clearSuggestion();
    }
  };

  const handleEditSuggestion = () => {
    if (suggestion) {
      setMessage(suggestion);
      clearSuggestion();
    }
  };

  const handleRequestSuggestion = () => {
    const messageContent = conversation.lastMessage?.body_text || conversation.lastMessage?.body_html?.replace(/<[^>]*>/g, '');
    if (!messageContent) return;
    
    fetchSuggestion({
      conversationId: conversation.id,
      customerMessage: messageContent,
      customerName: conversation.customer?.name,
      channel,
      context: {
        orderId: conversation.lastMessage.order_id || undefined,
        subject: conversation.lastMessage.subject || undefined,
      },
    });
  };

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
        // Send via email - use replyToEmail for marketplace messages (Bol.com, Amazon)
        const { error } = await supabase.functions.invoke('send-customer-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_email: conversation.replyToEmail || conversation.customer?.email,
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

      // Mark the last inbound message as replied
      const lastInbound = conversation.messages.find(
        m => m.direction === 'inbound' && !m.replied_at
      );
      
      if (lastInbound) {
        await supabase
          .from('customer_messages')
          .update({ 
            replied_at: new Date().toISOString(),
          })
          .eq('id', lastInbound.id);
      }

      toast({
        title: 'Bericht verzonden',
        description: `Antwoord verstuurd via ${channel === 'whatsapp' ? 'WhatsApp' : 'email'}.`,
      });

      setMessage('');
      clearSuggestion();
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

      {/* AI Suggestion Box */}
      {shouldShowAISuggestion && !aiConfig?.reply_suggestions_auto_draft && (
        <AISuggestionBox
          suggestion={suggestion || ''}
          onAccept={handleAcceptSuggestion}
          onEdit={handleEditSuggestion}
          onDismiss={clearSuggestion}
          isLoading={isSuggestionLoading}
          className="mb-3"
        />
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
        <div className="flex flex-col gap-1 self-end">
          {shouldShowAISuggestion && !suggestion && !isSuggestionLoading && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleRequestSuggestion}
              title="AI suggestie"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="h-auto"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Druk op Cmd+Enter om te verzenden
      </p>
    </div>
  );
}
