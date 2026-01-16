import { useState } from 'react';
import { User, Lock, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function AccountSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [fullName, setFullName] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Fetch profile on mount
  useState(() => {
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
  });

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
        title: 'Profiel bijgewerkt',
        description: 'Je profielgegevens zijn opgeslagen.',
      });
    } catch (error: any) {
      toast({
        title: 'Fout bij opslaan',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Wachtwoorden komen niet overeen',
        description: 'Controleer je nieuwe wachtwoord.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Wachtwoord te kort',
        description: 'Je wachtwoord moet minimaal 6 tekens zijn.',
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
        title: 'Wachtwoord bijgewerkt',
        description: 'Je wachtwoord is succesvol gewijzigd.',
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Fout bij wijzigen wachtwoord',
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
              <CardTitle>Profiel</CardTitle>
              <CardDescription>
                Beheer je persoonlijke gegevens
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
              <p className="font-medium">{fullName || 'Geen naam ingesteld'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Je e-mailadres kan niet worden gewijzigd.
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="fullName">Volledige naam</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Voer je naam in"
              />
            </div>

            <Button 
              onClick={handleUpdateProfile} 
              disabled={isUpdatingProfile}
              className="w-fit"
            >
              {isUpdatingProfile ? 'Opslaan...' : 'Profiel opslaan'}
            </Button>
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
              <CardTitle>Wachtwoord</CardTitle>
              <CardDescription>
                Wijzig je wachtwoord voor extra beveiliging
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Bevestig wachtwoord</Label>
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
              {isUpdatingPassword ? 'Wijzigen...' : 'Wachtwoord wijzigen'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
