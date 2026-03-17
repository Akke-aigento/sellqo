import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Mail, MessageSquare, Sparkles, X, Facebook, Instagram, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { useAISuggestion } from '@/hooks/useAISuggestion';
import { AISuggestionBox } from './AISuggestionBox';
import { AttachmentUploader } from './AttachmentUploader';
import { TemplatePicker } from './TemplatePicker';
import { ComposeRichEditor, type ComposeRichEditorRef } from './ComposeRichEditor';
import { useEmailSignatures } from '@/hooks/useEmailSignature';
import type { Conversation, MessageChannel, isSocialChannel } from '@/hooks/useInbox';

type ReplyChannel = 'email' | 'whatsapp' | 'facebook' | 'instagram';

interface UploadedFile {
  file: File;
  preview?: string;
}

interface ReplyComposerProps {
  conversation: Conversation;
  onSent: () => void;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export function ReplyComposer({ conversation, onSent }: ReplyComposerProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ComposeRichEditorRef>(null);
  const [message, setMessage] = useState('');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [signatureAppended, setSignatureAppended] = useState(false);

  const { defaultSignature } = useEmailSignatures();

  // Determine initial channel based on conversation
  const getInitialChannel = (): ReplyChannel => {
    const ch = conversation.channel;
    if (ch === 'whatsapp') return 'whatsapp';
    if (ch === 'facebook') return 'facebook';
    if (ch === 'instagram') return 'instagram';
    return 'email';
  };
  
  const [channel, setChannel] = useState<ReplyChannel>(getInitialChannel());
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  const isEmailChannel = channel === 'email';

  // Auto-append signature for email channel
  useEffect(() => {
    if (isEmailChannel && defaultSignature && !signatureAppended && !message) {
      const sigHtml = `<p></p><p>--</p>${defaultSignature.body_html}`;
      setMessage(sigHtml);
      setSignatureAppended(true);
    }
  }, [isEmailChannel, defaultSignature, signatureAppended, message]);

  // Reset signature flag when conversation changes
  useEffect(() => {
    setSignatureAppended(false);
    setMessage('');
  }, [conversation.id]);

  // AI Suggestion integration
  const { config: aiConfig } = useAIAssistant();
  const { 
    suggestion, 
    isLoading: isSuggestionLoading, 
    isCached,
    fetchSuggestion, 
    loadCachedSuggestion,
    clearSuggestion 
  } = useAISuggestion();

  const canSendWhatsApp = conversation.customer?.phone && currentTenant?.whatsapp_enabled;
  const canSendEmail = !!conversation.customer?.email;
  
  const canSendFacebook = conversation.channel === 'facebook' || 
    (conversation.lastMessage?.meta_sender_id && conversation.lastMessage?.channel === 'facebook');
  const canSendInstagram = conversation.channel === 'instagram' || 
    (conversation.lastMessage?.meta_sender_id && conversation.lastMessage?.channel === 'instagram');
  
  const hasMultipleChannels = [canSendEmail, canSendWhatsApp, canSendFacebook, canSendInstagram].filter(Boolean).length > 1;

  const shouldShowAISuggestion = aiConfig?.reply_suggestions_enabled && (
    (channel === 'email' && aiConfig.reply_suggestions_for_email) ||
    (['whatsapp', 'facebook', 'instagram'].includes(channel) && aiConfig.reply_suggestions_for_whatsapp)
  );

  const lastInboundMessage = conversation.lastMessage?.direction === 'inbound' 
    ? conversation.lastMessage 
    : null;

  useEffect(() => {
    if (!shouldShowAISuggestion || !lastInboundMessage) return;
    
    const messageId = lastInboundMessage.id;
    const messageContent = lastInboundMessage.body_text || lastInboundMessage.body_html?.replace(/<[^>]*>/g, '');
    
    if (!messageContent) return;

    loadCachedSuggestion(messageId).then((cached) => {
      if (!cached && aiConfig?.reply_suggestions_auto_generate) {
        fetchSuggestion({
          conversationId: conversation.id,
          messageId,
          customerMessage: messageContent,
          customerName: conversation.customer?.name,
          channel: channel === 'email' ? 'email' : 'whatsapp',
          context: {
            orderId: lastInboundMessage.order_id || undefined,
            subject: lastInboundMessage.subject || undefined,
          },
        });
      }
    });
  }, [conversation.id, lastInboundMessage?.id, shouldShowAISuggestion, aiConfig?.reply_suggestions_auto_generate]);

  useEffect(() => {
    if (suggestion && aiConfig?.reply_suggestions_auto_draft && !message) {
      setMessage(suggestion);
      clearSuggestion();
    }
  }, [suggestion, aiConfig?.reply_suggestions_auto_draft]);

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      if (isEmailChannel && editorRef.current) {
        editorRef.current.insertContent(suggestion);
      } else {
        setMessage(suggestion);
      }
      clearSuggestion();
    }
  };

  const handleEditSuggestion = () => {
    if (suggestion) {
      if (isEmailChannel && editorRef.current) {
        editorRef.current.insertContent(suggestion);
      } else {
        setMessage(suggestion);
      }
      clearSuggestion();
    }
  };

  const handleRequestSuggestion = () => {
    const messageContent = lastInboundMessage?.body_text || lastInboundMessage?.body_html?.replace(/<[^>]*>/g, '');
    if (!messageContent || !lastInboundMessage) return;
    
    fetchSuggestion({
      conversationId: conversation.id,
      messageId: lastInboundMessage.id,
      customerMessage: messageContent,
      customerName: conversation.customer?.name,
      channel: channel === 'email' ? 'email' : 'whatsapp',
      context: {
        orderId: lastInboundMessage.order_id || undefined,
        subject: lastInboundMessage.subject || undefined,
      },
    });
  };

  const handleRegenerateSuggestion = () => {
    const messageContent = lastInboundMessage?.body_text || lastInboundMessage?.body_html?.replace(/<[^>]*>/g, '');
    if (!messageContent || !lastInboundMessage) return;
    
    fetchSuggestion({
      conversationId: conversation.id,
      messageId: lastInboundMessage.id,
      customerMessage: messageContent,
      customerName: conversation.customer?.name,
      channel: channel === 'email' ? 'email' : 'whatsapp',
      forceRegenerate: true,
      context: {
        orderId: lastInboundMessage.order_id || undefined,
        subject: lastInboundMessage.subject || undefined,
      },
    });
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: UploadedFile[] = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));
    setAttachments(prev => [...prev, ...newAttachments].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      const removed = updated.splice(index, 1)[0];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return updated;
    });
  };

  const getMessageContent = () => {
    if (isEmailChannel) {
      return { html: message, text: stripHtml(message) };
    }
    return { html: message.trim().replace(/\n/g, '<br>'), text: message.trim() };
  };

  const isMessageEmpty = () => {
    if (isEmailChannel) {
      const text = stripHtml(message).trim();
      // If only signature remains, treat as empty
      const sigText = defaultSignature ? stripHtml(`--${defaultSignature.body_html}`).trim() : '';
      return !text || text === sigText || text === '--';
    }
    return !message.trim();
  };

  const handleSend = async () => {
    if (isMessageEmpty() || !currentTenant?.id) return;

    // Handle internal note
    if (isNoteMode) {
      setIsSending(true);
      try {
        const { html, text } = getMessageContent();
        const { error } = await supabase
          .from('customer_messages')
          .insert({
            tenant_id: currentTenant.id,
            direction: 'internal',
            subject: conversation.lastMessage.subject || 'Interne notitie',
            body_html: html,
            body_text: text,
            from_email: 'system',
            to_email: 'internal',
            channel: conversation.channel === 'mixed' || conversation.channel === 'social' ? 'email' : conversation.channel,
            delivery_status: 'sent',
            message_status: conversation.messageStatus || 'active',
            customer_id: conversation.customer?.id || null,
            order_id: conversation.lastMessage.order_id || null,
            folder_id: conversation.folderId || null,
          });
        if (error) throw error;
        toast({ title: 'Notitie toegevoegd', description: 'Interne notitie is opgeslagen.' });
        setMessage('');
        setSignatureAppended(false);
        setIsNoteMode(false);
        onSent();
      } catch (error) {
        console.error('Error saving note:', error);
        toast({ title: 'Fout', description: 'Kon notitie niet opslaan.', variant: 'destructive' });
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    try {
      const { html, text } = getMessageContent();

      if (channel === 'whatsapp') {
        const { error } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_id: conversation.customer?.id,
            to_phone: conversation.customer?.phone,
            message: text,
            template_type: 'custom',
          },
        });
        if (error) throw error;
      } else if (channel === 'facebook' || channel === 'instagram') {
        const { error } = await supabase.functions.invoke('send-meta-message', {
          body: {
            tenant_id: currentTenant.id,
            platform: channel,
            recipient_id: conversation.lastMessage?.meta_sender_id,
            page_id: conversation.lastMessage?.meta_page_id,
            message: text,
            customer_id: conversation.customer?.id,
          },
        });
        if (error) throw error;
      } else {
        // Email
        const conversationMessages = conversation.messages || [];
        const lastInbound = conversationMessages.find(m => m.direction === 'inbound');
        const contextData = (lastInbound as any)?.context_data || {};
        const inReplyTo = contextData.message_id || null;
        const references = contextData.references 
          ? `${contextData.references} ${inReplyTo || ''}`.trim()
          : inReplyTo || null;

        const { error } = await supabase.functions.invoke('send-customer-message', {
          body: {
            tenant_id: currentTenant.id,
            customer_email: conversation.replyToEmail || conversation.customer?.email,
            customer_name: conversation.customer?.name,
            subject: `Re: ${conversation.lastMessage.subject || 'Uw bericht'}`,
            body_html: html,
            body_text: text,
            context_type: 'general',
            customer_id: conversation.customer?.id,
            in_reply_to: inReplyTo,
            references: references,
          },
        });
        if (error) throw error;
      }

      // Mark the last inbound message as replied
      const msgs = conversation.messages || [];
      const lastInboundToMark = msgs.find(
        m => m.direction === 'inbound' && !m.replied_at
      );
      
      if (lastInboundToMark) {
        await supabase
          .from('customer_messages')
          .update({ replied_at: new Date().toISOString() })
          .eq('id', lastInboundToMark.id);
      }

      const channelLabels: Record<ReplyChannel, string> = {
        email: 'email',
        whatsapp: 'WhatsApp',
        facebook: 'Facebook Messenger',
        instagram: 'Instagram',
      };

      toast({
        title: 'Bericht verzonden',
        description: `Antwoord verstuurd via ${channelLabels[channel]}.`,
      });

      setMessage('');
      setSignatureAppended(false);
      setAttachments([]);
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

  const handleTemplateSelect = (body: string) => {
    if (isEmailChannel && editorRef.current) {
      editorRef.current.insertContent(body);
    } else {
      setMessage(prev => prev ? prev + '\n' + body : body);
    }
  };

  return (
    <div className={cn('border-t p-4', isNoteMode ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-background')}>
      {/* Channel selector */}
      {hasMultipleChannels && (
        <Tabs value={channel} onValueChange={(v) => setChannel(v as ReplyChannel)} className="mb-3">
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
            {canSendFacebook && (
              <TabsTrigger value="facebook" className="text-xs px-3 h-7">
                <Facebook className="h-3 w-3 mr-1" />
                Facebook
              </TabsTrigger>
            )}
            {canSendInstagram && (
              <TabsTrigger value="instagram" className="text-xs px-3 h-7">
                <Instagram className="h-3 w-3 mr-1" />
                Instagram
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
          onRegenerate={handleRegenerateSuggestion}
          isLoading={isSuggestionLoading}
          isCached={isCached}
          className="mb-3"
        />
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((att, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs">
              {att.preview ? (
                <img src={att.preview} alt="" className="h-4 w-4 rounded object-cover" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              <span className="max-w-[100px] truncate">{att.file.name}</span>
              <button onClick={() => removeAttachment(idx)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />

      {/* Message input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          {isEmailChannel && !isNoteMode ? (
            <ComposeRichEditor
              ref={editorRef}
              content={message}
              onChange={setMessage}
              onSubmit={handleSend}
              placeholder="Typ je antwoord..."
            />
          ) : (
            <Textarea
              placeholder={isNoteMode ? 'Schrijf een interne notitie... (alleen zichtbaar voor het team)' : 'Typ je antwoord...'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={cn('min-h-[120px] resize-y pr-10', isNoteMode && 'border-amber-300 dark:border-amber-700')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSend();
                }
              }}
            />
          )}
          {!isEmailChannel && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 bottom-1 h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleAttachmentClick}
              type="button"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-1 self-end">
          {/* Attachment for email */}
          {isEmailChannel && !isNoteMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAttachmentClick}>
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bijlage toevoegen</TooltipContent>
            </Tooltip>
          )}
          {/* Template picker */}
          {!isNoteMode && (
            <TemplatePicker onSelect={handleTemplateSelect} />
          )}
          {/* Internal note toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isNoteMode ? 'default' : 'outline'}
                size="icon"
                className={cn('h-8 w-8', isNoteMode && 'bg-amber-500 hover:bg-amber-600')}
                onClick={() => setIsNoteMode(!isNoteMode)}
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isNoteMode ? 'Terug naar antwoord' : 'Interne notitie'}</TooltipContent>
          </Tooltip>
          {shouldShowAISuggestion && !suggestion && !isSuggestionLoading && !isNoteMode && (
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
            disabled={isMessageEmpty() || isSending}
            className={cn('h-auto', isNoteMode && 'bg-amber-500 hover:bg-amber-600')}
          >
            {isNoteMode ? <StickyNote className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {isNoteMode ? '📝 Notitie modus — alleen zichtbaar voor het team' : 'Druk op Cmd+Enter om te verzenden'}
      </p>
    </div>
  );
}
