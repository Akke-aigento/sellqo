import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Download, Upload, Copy, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SyncRules } from '@/types/syncRules';
import type { MarketplaceConnection } from '@/types/marketplace';

interface SyncConfigManagerProps {
  syncRules: SyncRules;
  currentConnectionId: string;
  otherConnections: MarketplaceConnection[];
  onImport: (rules: SyncRules) => void;
  onCopyToConnection: (targetConnectionId: string) => void;
}

export function SyncConfigManager({
  syncRules,
  currentConnectionId,
  otherConnections,
  onImport,
  onCopyToConnection,
}: SyncConfigManagerProps) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');

  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      syncRules,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Configuratie geëxporteerd');
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      
      if (!parsed.syncRules) {
        toast.error('Ongeldig configuratie bestand');
        return;
      }
      
      onImport(parsed.syncRules);
      setShowImportDialog(false);
      setImportJson('');
      toast.success('Configuratie geïmporteerd');
    } catch {
      toast.error('Kon JSON niet parsen');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
    };
    reader.readAsText(file);
  };

  const handleCopy = () => {
    if (!selectedConnectionId) {
      toast.error('Selecteer een connectie');
      return;
    }
    
    onCopyToConnection(selectedConnectionId);
    setShowCopyDialog(false);
    setSelectedConnectionId('');
    toast.success('Configuratie gekopieerd');
  };

  const eligibleConnections = otherConnections.filter(
    (c) => c.id !== currentConnectionId
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Configuratie Beheer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exporteer als JSON
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Importeer Configuratie
            </Button>
            
            {eligibleConnections.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCopyDialog(true)}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Kopieer naar andere connectie
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuratie Importeren</DialogTitle>
            <DialogDescription>
              Upload een eerder geëxporteerd configuratie bestand of plak de JSON.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Bestand uploaden</Label>
              <Input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Of plak JSON</Label>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                className="mt-1 w-full h-40 p-3 text-sm font-mono border rounded-md resize-none bg-background"
                placeholder='{"version": "1.0", "syncRules": {...}}'
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleImport} disabled={!importJson.trim()}>
              Importeren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kopieer naar andere connectie</DialogTitle>
            <DialogDescription>
              Kopieer de huidige sync configuratie naar een andere marketplace connectie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Doelconnectie</Label>
              <Select
                value={selectedConnectionId}
                onValueChange={setSelectedConnectionId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecteer connectie" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {eligibleConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.marketplace_name || conn.marketplace_type} ({conn.marketplace_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              Let op: Dit overschrijft de bestaande sync configuratie van de geselecteerde connectie.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCopy} disabled={!selectedConnectionId}>
              Kopiëren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
