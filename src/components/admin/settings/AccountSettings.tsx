import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { User, Lock, Camera, Globe, Palette, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingStatusCard } from '@/components/onboarding/OnboardingStatusCard';
import { supabase } from '@/integrations/supabase/client';

export function AccountSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, supportedLanguages, isLoading: isLanguageLoading } = useLanguage();
  const { restartOnboarding, resumeOnboarding } = useOnboarding();
  
  const [fullName, setFullName] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  // Email change state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailChangeRequested, setEmailChangeRequested] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (data?.full_name) {
        setFullName(data.full_name);
      }
    };
    fetchProfile();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast({
        title: t('settings.account.profileUpdated'),
        description: t('settings.account.profileUpdatedDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('settings.account.profileError'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast({
        title: 'Ongeldig e-mailadres',
        description: 'Voer een geldig e-mailadres in.',
        variant: 'destructive',
      });
      return;
    }

    if (newEmail === user?.email) {
      toast({
        title: 'Zelfde e-mailadres',
        description: 'Het nieuwe e-mailadres is hetzelfde als het huidige.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingEmail(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      }, {
        emailRedirectTo: `${window.location.origin}/admin`,
      });
      
      if (error) throw error;
      
      setEmailChangeRequested(true);
      setShowEmailDialog(false);
      
      toast({
        title: 'Bevestigingsmail verzonden',
        description: 'Check je inbox voor beide e-mailadressen om de wijziging te bevestigen.',
      });
    } catch (error: any) {
      toast({
        title: 'E-mail wijzigen mislukt',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('settings.password.mismatch'),
        description: t('settings.password.mismatchDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('settings.password.tooShort'),
        description: t('settings.password.tooShortDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) throw error;
      
      toast({
        title: t('settings.password.updated'),
        description: t('settings.password.updatedDescription'),
      });
      
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: t('settings.password.error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t('settings.account.profile')}</CardTitle>
              <CardDescription>
                {t('settings.account.manageProfile')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" />
                <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
              </Avatar>
              <Button 
                size="icon" 
                variant="outline" 
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                disabled
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <p className="font-medium">{fullName || t('common.name')}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          {emailChangeRequested && (
            <Alert className="bg-blue-50 border-blue-200">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Er is een bevestigingsmail verzonden. Check je inbox voor zowel je oude als nieuwe e-mailadres om de wijziging te voltooien.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted flex-1"
                />
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setNewEmail('');
                    setShowEmailDialog(true);
                  }}
                >
                  Wijzigen
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Je ontvangt een bevestigingsmail op zowel je huidige als nieuwe e-mailadres.
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="fullName">{t('settings.account.fullName')}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('settings.account.fullName')}
              />
            </div>

            <Button 
              onClick={handleUpdateProfile} 
              disabled={isUpdatingProfile}
              className="w-fit"
            >
              {isUpdatingProfile ? t('common.loading') : t('settings.account.saveProfile')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Status Card */}
      <OnboardingStatusCard 
        onRestart={restartOnboarding} 
        onResume={resumeOnboarding} 
      />

      {/* Interface Language Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t('settings.account.language')}</CardTitle>
              <CardDescription>
                {t('settings.account.languageDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs">
            <Select 
              value={language} 
              onValueChange={setLanguage}
              disabled={isLanguageLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Dit wijzigt alleen hoe Sellqo eruitziet voor jou. De taal voor content invoer stel je in bij Winkelinstellingen.
          </p>
        </CardContent>
      </Card>

      {/* Theme Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Palette className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t('settings.account.theme')}</CardTitle>
              <CardDescription>
                {t('settings.account.themeDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select 
              value={theme} 
              onValueChange={setTheme}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('settings.account.themeLight')}</SelectItem>
                <SelectItem value="dark">{t('settings.account.themeDark')}</SelectItem>
                <SelectItem value="system">{t('settings.account.themeSystem')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t('settings.password.title')}</CardTitle>
              <CardDescription>
                {t('settings.password.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">{t('settings.password.new')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">{t('settings.password.confirm')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button 
              onClick={handleUpdatePassword} 
              disabled={isUpdatingPassword || !newPassword || !confirmPassword}
              className="w-fit"
            >
              {isUpdatingPassword ? t('common.loading') : t('settings.password.change')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Change Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>E-mailadres wijzigen</DialogTitle>
            <DialogDescription>
              Voer je nieuwe e-mailadres in. Je ontvangt een bevestigingsmail op zowel je huidige als nieuwe e-mailadres.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Huidig e-mailadres</Label>
              <Input value={user?.email || ''} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-email">Nieuw e-mailadres</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nieuw@voorbeeld.com"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Na het bevestigen via beide e-mailadressen wordt je automatisch uitgelogd en moet je opnieuw inloggen met je nieuwe e-mailadres.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleUpdateEmail} 
              disabled={isUpdatingEmail || !newEmail}
            >
              {isUpdatingEmail ? 'Verzenden...' : 'Bevestigingsmail versturen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
