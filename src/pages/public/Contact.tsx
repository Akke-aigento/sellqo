import { useState } from 'react';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Phone, MapPin, MessageSquare, Clock, Calendar, Headphones, Building2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';

const subjectDefs = [
  { value: 'sales', responseKey: 'oneDay' },
  { value: 'support', responseKey: 'oneDay' },
  { value: 'partnership', responseKey: 'twoDays' },
  { value: 'technical', responseKey: 'oneDay' },
  { value: 'other', responseKey: 'twoDays' },
] as const;

const contactMethodDefs = [
  { key: 'email', icon: Mail, value: 'info@sellqo.app', href: 'mailto:info@sellqo.app' },
  { key: 'whatsapp', icon: MessageSquare, value: '+32 490 39 75 44', href: 'https://wa.me/32490397544' },
  { key: 'phone', icon: Phone, value: '+32 490 39 75 44', href: 'tel:+32490397544' },
] as const;

export default function Contact() {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');

  const subjects = subjectDefs.map((s) => ({
    value: s.value,
    label: t(`public.contact.subjects.${s.value}`),
    responseTime: t(`public.contact.responseTimes.${s.responseKey}`),
  }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success(t('public.contact.form.success'));
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
    setSelectedSubject('');
  };

  const currentSubject = subjects.find(s => s.value === selectedSubject);

  return (
    <>
    <PageMeta
      title={t('public.contact.meta.title')}
      description={t('public.contact.meta.description')}
      path="/contact"
    />
    <PublicPageLayout 
      title={t('public.contact.title')}
      subtitle={t('public.contact.subtitle')}
    >
      {/* Quick Contact Methods */}
      <section className="max-w-4xl mx-auto mb-12">
        <div className="grid sm:grid-cols-3 gap-4">
          {contactMethodDefs.map((method, index) => (
            <a
              key={index}
              href={method.href}
              className="bg-card rounded-xl border border-border p-5 hover:border-accent/50 transition-colors group text-center"
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-accent/20 transition-colors">
                <method.icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{t(`public.contact.methods.${method.key}.title`)}</h3>
              <p className="text-accent text-sm mb-1">{method.value}</p>
              <p className="text-xs text-muted-foreground">{t(`public.contact.methods.${method.key}.description`)}</p>
            </a>
          ))}
        </div>
      </section>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
        {/* Contact Form */}
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
          <h2 className="text-xl font-bold text-foreground mb-6">{t('public.contact.form.title')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('public.contact.form.name')} *</Label>
                <Input id="name" placeholder={t('public.contact.form.namePlaceholder')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">{t('public.contact.form.company')}</Label>
                <Input id="company" placeholder={t('public.contact.form.companyPlaceholder')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('public.contact.form.email')} *</Label>
              <Input id="email" type="email" placeholder={t('public.contact.form.emailPlaceholder')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">{t('public.contact.form.subject')} *</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} required>
                <SelectTrigger>
                  <SelectValue placeholder={t('public.contact.form.subjectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentSubject && (
                <p className="text-xs text-accent flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t('public.contact.form.expected', { time: currentSubject.responseTime })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">{t('public.contact.form.message')} *</Label>
              <Textarea 
                id="message" 
                placeholder={t('public.contact.form.messagePlaceholder')}
                rows={5}
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('public.contact.form.submitting') : t('public.contact.form.submit')}
            </Button>
          </form>
        </div>

        {/* Contact Info & Options */}
        <div className="space-y-6">
          {/* Response Times */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">{t('public.contact.responseTitle')}</h2>
            <div className="space-y-3">
              {subjects.map((subject) => (
                <div key={subject.value} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-foreground">{subject.label}</span>
                  <span className="text-sm text-accent font-medium">{subject.responseTime}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Company Information — legal entity */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">{t('public.contact.companyTitle')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t('public.contact.companyText')}</p>
                <p className="text-foreground text-sm leading-relaxed mt-2">
                  <span className="font-medium">Nomadix BV</span><br />
                  Beekstraat 49<br />
                  3051 Oud-Heverlee, Belgium<br />
                  Company number: BE 1017.500.207<br />
                  Email:{' '}
                  <a href="mailto:info@sellqo.app" className="text-accent hover:underline">
                    info@sellqo.app
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Enterprise CTA */}
          <div className="bg-gradient-to-br from-accent/10 to-primary/10 rounded-2xl border border-accent/30 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">{t('public.contact.enterprise.title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t('public.contact.enterprise.text')}</p>
                <Button variant="outline" className="w-full" asChild>
                  <a href="https://calendly.com" target="_blank" rel="noopener noreferrer">
                    <Calendar className="w-4 h-4 mr-2" />
                    {t('public.contact.enterprise.button')}
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Live Chat Placeholder */}
          <div className="bg-secondary/30 rounded-2xl border border-border p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Headphones className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">{t('public.contact.livechat.title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('public.contact.livechat.text')}</p>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
              <Zap className="w-3 h-3" />
              {t('public.contact.livechat.badge')}
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
    </>
  );
}
