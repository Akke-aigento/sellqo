import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';
import { ComposeRichEditor } from '@/components/admin/inbox/ComposeRichEditor';
import { useEmailSignatures, type EmailSignature } from '@/hooks/useEmailSignature';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function SignatureSettings() {
  const { signatures, isLoading, upsertSignature, deleteSignature } = useEmailSignatures();
  const [editOpen, setEditOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState<Partial<EmailSignature> | null>(null);
  const [name, setName] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const openNew = () => {
    setEditingSignature(null);
    setName('Standaard');
    setBodyHtml('');
    setIsDefault(signatures.length === 0);
    setEditOpen(true);
  };

  const openEdit = (sig: EmailSignature) => {
    setEditingSignature(sig);
    setName(sig.name);
    setBodyHtml(sig.body_html);
    setIsDefault(sig.is_default);
    setEditOpen(true);
  };

  const handleSave = () => {
    upsertSignature.mutate(
      { id: editingSignature?.id, name, body_html: bodyHtml, is_default: isDefault },
      { onSuccess: () => setEditOpen(false) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">E-mail handtekeningen</CardTitle>
            <CardDescription>Wordt automatisch toegevoegd onder elke e-mail reply.</CardDescription>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nieuw
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : signatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen handtekeningen aangemaakt.</p>
        ) : (
          <div className="space-y-3">
            {signatures.map((sig) => (
              <div key={sig.id} className="flex items-start justify-between border rounded-md p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{sig.name}</span>
                    {sig.is_default && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Check className="h-3 w-3" /> Standaard
                      </span>
                    )}
                  </div>
                  <div
                    className="text-xs text-muted-foreground prose prose-xs max-w-none line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: sig.body_html }}
                  />
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sig)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSignature.mutate(sig.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSignature ? 'Handtekening bewerken' : 'Nieuwe handtekening'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Naam</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="bijv. Klantenservice" />
            </div>
            <div>
              <Label>Inhoud</Label>
              <ComposeRichEditor content={bodyHtml} onChange={setBodyHtml} placeholder="Typ je handtekening..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <Label>Gebruik als standaard</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={!name.trim() || upsertSignature.isPending}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
