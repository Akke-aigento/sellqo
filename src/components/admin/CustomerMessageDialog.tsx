import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomerMessages } from '@/hooks/useCustomerMessages';
import { Mail, Send, Loader2, Clock, Package, FileText, MessageSquare } from 'lucide-react';

interface CustomerMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerEmail: string;
  customerName: string;
  contextType: 'order' | 'quote' | 'general';
  orderId?: string;
  quoteId?: string;
  customerId?: string;
  orderNumber?: string;
  quoteNumber?: string;
}

type TemplateKey = 'delay' | 'tracking' | 'question' | 'confirmation' | 'custom';

interface Template {
  label: string;
  icon: React.ElementType;
  subject: string;
  body: string;
}

const MESSAGE_TEMPLATES: Record<TemplateKey, Template> = {
  delay: {
    label: 'Vertraging melden',
    icon: Clock,
    subject: 'Update over je bestelling',
    body: 'We willen je laten weten dat er een kleine vertraging is met je bestelling. We verwachten dat deze binnen [X] dagen bij je wordt bezorgd.\n\nOnze excuses voor het ongemak.',
  },
  tracking: {
    label: 'Tracking informatie',
    icon: Package,
    subject: 'Je bestelling is onderweg!',
    body: 'Goed nieuws! Je bestelling is verzonden en onderweg naar jou.\n\nJe kunt je pakket volgen via de volgende link:\n[TRACKING LINK]\n\nVerwachte levering: [DATUM]',
  },
  question: {
    label: 'Vraag stellen',
    icon: MessageSquare,
    subject: 'Vraag over je bestelling',
    body: 'We hebben een vraag over je bestelling en hopen dat je ons kunt helpen.\n\n[JE VRAAG HIER]\n\nKun je ons zo snel mogelijk laten weten? Bij voorbaat dank!',
  },
  confirmation: {
    label: 'Bevestiging',
    icon: FileText,
    subject: 'Bevestiging ontvangen',
    body: 'Bedankt voor je bericht! We hebben dit goed ontvangen en zullen zo snel mogelijk reageren.\n\nMocht je nog vragen hebben, neem dan gerust contact met ons op.',
  },
  custom: {
    label: 'Eigen bericht',
    icon: Mail,
    subject: '',
    body: '',
  },
};

export function CustomerMessageDialog({
  open,
  onOpenChange,
  customerEmail,
  customerName,
  contextType,
  orderId,
  quoteId,
  customerId,
  orderNumber,
  quoteNumber,
}: CustomerMessageDialogProps) {
  const { t } = useTranslation();
  const { sendMessage } = useCustomerMessages();
  const [template, setTemplate] = useState<TemplateKey>('custom');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const handleTemplateChange = (value: TemplateKey) => {
    setTemplate(value);
    const tmpl = MESSAGE_TEMPLATES[value];
    
    // Pre-fill subject with context
    let newSubject = tmpl.subject;
    if (contextType === 'order' && orderNumber && !newSubject.includes(orderNumber)) {
      newSubject = newSubject || `Betreft bestelling ${orderNumber}`;
    } else if (contextType === 'quote' && quoteNumber && !newSubject.includes(quoteNumber)) {
      newSubject = newSubject || `Betreft offerte ${quoteNumber}`;
    }
    
    setSubject(newSubject);
    setBody(tmpl.body);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    await sendMessage.mutateAsync({
      customer_email: customerEmail,
      customer_name: customerName,
      subject,
      body_html: body.replace(/\n/g, '<br>'),
      body_text: body,
      context_type: contextType,
      order_id: orderId,
      quote_id: quoteId,
      customer_id: customerId,
      context_data: {
        order_number: orderNumber,
        quote_number: quoteNumber,
      },
    });

    // Reset and close
    setSubject('');
    setBody('');
    setTemplate('custom');
    onOpenChange(false);
  };

  const contextLabel = contextType === 'order' 
    ? `Bestelling ${orderNumber}` 
    : contextType === 'quote' 
      ? `Offerte ${quoteNumber}` 
      : 'Algemeen';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email naar klant
          </DialogTitle>
          <DialogDescription>
            Stuur een bericht naar {customerName || customerEmail}
            {contextType !== 'general' && (
              <span className="ml-1 text-primary">• {contextLabel}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient display */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Naar:</span>
            <span className="text-sm font-medium">{customerEmail}</span>
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={template} onValueChange={(v) => handleTemplateChange(v as TemplateKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MESSAGE_TEMPLATES) as [TemplateKey, Template][]).map(([key, tmpl]) => {
                  const Icon = tmpl.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {tmpl.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Onderwerp</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Onderwerp van je bericht..."
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Bericht</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Schrijf je bericht hier..."
              rows={8}
              className="resize-none"
            />
          </div>

          {/* Reply info */}
          <p className="text-xs text-muted-foreground">
            💡 De klant kan direct antwoorden op deze email. Het antwoord gaat naar je eigen emailadres.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!subject.trim() || !body.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verzenden...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Verzenden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
