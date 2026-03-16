import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Monitor, 
  Plus, 
  Settings, 
  Play, 
  Pause, 
  MoreHorizontal,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Maximize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePOSTerminals, usePOSSessions } from '@/hooks/usePOS';
import type { POSTerminal } from '@/types/pos';

export default function POSPage() {
  const navigate = useNavigate();
  const { terminals, isLoading, createTerminal, deleteTerminal } = usePOSTerminals();
  const { sessions } = usePOSSessions();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalLocation, setNewTerminalLocation] = useState('');

  const handleCreateTerminal = async () => {
    if (!newTerminalName.trim()) return;
    
    await createTerminal.mutateAsync({
      name: newTerminalName,
      location_name: newTerminalLocation || undefined,
    });
    
    setShowCreateDialog(false);
    setNewTerminalName('');
    setNewTerminalLocation('');
  };

  const getTerminalSession = (terminalId: string) => {
    return sessions.find(s => s.terminal_id === terminalId && s.status === 'open');
  };

  const getStatusBadge = (terminal: POSTerminal) => {
    const activeSession = getTerminalSession(terminal.id);
    
    if (terminal.status === 'maintenance') {
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Onderhoud</Badge>;
    }
    if (terminal.status === 'inactive') {
      return <Badge variant="outline" className="bg-muted text-muted-foreground">Inactief</Badge>;
    }
    if (activeSession) {
      return <Badge className="bg-green-500 hover:bg-green-600">Actief</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Beschikbaar</Badge>;
  };

  const handleOpenPOS = (terminal: POSTerminal) => {
    navigate(`/admin/pos/${terminal.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kassa (POS)</h1>
          <p className="text-muted-foreground">
            Beheer je kassaterminals en start een verkoopddag
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Terminal
        </Button>
      </div>

      {/* Terminals Grid */}
      {terminals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Geen terminals</h3>
            <p className="text-muted-foreground text-center mb-4">
              Maak je eerste kassaterminal aan om te beginnen met verkopen.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Terminal Aanmaken
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {terminals.map((terminal) => {
            const activeSession = getTerminalSession(terminal.id);
            
            return (
              <Card key={terminal.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Monitor className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{terminal.name}</CardTitle>
                        {terminal.location_name && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {terminal.location_name}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/pos/terminals/${terminal.id}`)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Instellingen
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteTerminal.mutate(terminal.id)}
                          className="text-destructive"
                        >
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    {getStatusBadge(terminal)}
                    {activeSession && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(activeSession.opened_at).toLocaleTimeString('nl-NL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Capabilities */}
                  <div className="flex gap-2">
                    {terminal.capabilities.scanner && (
                      <Badge variant="secondary" className="text-xs">Scanner</Badge>
                    )}
                    {terminal.capabilities.printer && (
                      <Badge variant="secondary" className="text-xs">Printer</Badge>
                    )}
                    {terminal.capabilities.cash_drawer && (
                      <Badge variant="secondary" className="text-xs">Kassalade</Badge>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1" 
                      onClick={() => handleOpenPOS(terminal)}
                      variant={activeSession ? "default" : "outline"}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {activeSession ? 'Kassa Openen' : 'Dag Starten'}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/admin/pos/${terminal.id}?fullscreen=1`)}
                      title="Fullscreen kassaweergave"
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Sessions Summary */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recente Sessies</CardTitle>
            <CardDescription>Overzicht van de laatste kassadagen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.slice(0, 5).map((session) => (
                <div 
                  key={session.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {session.status === 'open' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : session.cash_difference && session.cash_difference !== 0 ? (
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {session.terminal?.name || 'Terminal'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.opened_at).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                      {session.status === 'open' ? 'Actief' : 'Gesloten'}
                    </Badge>
                    {session.status === 'closed' && session.cash_difference !== null && (
                      <p className={`text-sm mt-1 ${
                        session.cash_difference === 0 
                          ? 'text-green-600' 
                          : session.cash_difference > 0 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      }`}>
                        {session.cash_difference === 0 
                          ? 'Kloppend' 
                          : session.cash_difference > 0 
                            ? `+€${session.cash_difference.toFixed(2)}` 
                            : `-€${Math.abs(session.cash_difference).toFixed(2)}`
                        }
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Terminal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Terminal Aanmaken</DialogTitle>
            <DialogDescription>
              Geef je kassaterminal een naam en optionele locatie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam *</Label>
              <Input
                id="name"
                placeholder="bijv. Kassa 1"
                value={newTerminalName}
                onChange={(e) => setNewTerminalName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Locatie</Label>
              <Input
                id="location"
                placeholder="bijv. Winkel Amsterdam"
                value={newTerminalLocation}
                onChange={(e) => setNewTerminalLocation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleCreateTerminal}
              disabled={!newTerminalName.trim() || createTerminal.isPending}
            >
              {createTerminal.isPending ? 'Aanmaken...' : 'Aanmaken'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
