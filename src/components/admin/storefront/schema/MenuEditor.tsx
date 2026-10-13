// THEME-SCHEMA-1 — hoofdmenu van de standaardshop (theme_config.menu). Leeg = de shop
// toont automatisch de hoofdcategorieën, zoals voorheen.
import { ArrowDown, ArrowUp, CornerDownRight, Plus, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface MenuItem { id: string; label: string; type: 'category' | 'page' | 'legal' | 'all' | 'url'; ref?: string; children?: MenuItem[] }
interface Flat { id: string; label: string; type: MenuItem['type']; ref?: string; depth: 0 | 1 }

const LEGAL = [
  { value: 'contact', label: 'Contactgegevens' }, { value: 'terms', label: 'Algemene voorwaarden' },
  { value: 'privacy', label: 'Privacybeleid' }, { value: 'refund', label: 'Retourbeleid' },
  { value: 'shipping', label: 'Verzendbeleid' }, { value: 'cookie', label: 'Cookiebeleid' },
];
const TYPES: { value: MenuItem['type']; label: string }[] = [
  { value: 'category', label: 'Categorie' }, { value: 'all', label: 'Alle producten' },
  { value: 'page', label: 'Eigen pagina' }, { value: 'legal', label: 'Juridische pagina' }, { value: 'url', label: 'Eigen link' },
];
const newId = () => Math.random().toString(36).slice(2, 10);

function flatten(menu: MenuItem[]): Flat[] {
  return menu.flatMap((m) => [
    { id: m.id, label: m.label, type: m.type, ref: m.ref, depth: 0 as const },
    ...(m.children || []).map((c) => ({ id: c.id, label: c.label, type: c.type, ref: c.ref, depth: 1 as const })),
  ]);
}
function tree(flat: Flat[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const f of flat) {
    const item: MenuItem = { id: f.id, label: f.label, type: f.type, ...(f.ref ? { ref: f.ref } : {}) };
    if (f.depth === 1 && out.length) (out[out.length - 1].children ||= []).push(item);
    else out.push(item);
  }
  return out;
}

export function MenuEditor({ menu, onChange, categories, pages }: {
  menu: MenuItem[]; onChange: (m: MenuItem[]) => void;
  categories: { id: string; name: string; slug: string; parent_id?: string | null }[];
  pages: { slug: string; title: string }[];
}) {
  const flat = flatten(menu);
  const set = (next: Flat[]) => onChange(tree(next));
  const update = (i: number, patch: Partial<Flat>) => set(flat.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: number) => { const n = [...flat]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); if (n[0]) n[0] = { ...n[0], depth: 0 }; set(n); };

  const startFromCategories = () => onChange(categories.filter((c) => !c.parent_id).slice(0, 7).map((c) => ({ id: newId(), label: c.name, type: 'category' as const, ref: c.slug })));
  const add = () => set([...flat, { id: newId(), label: categories[0]?.name || 'Nieuw', type: categories[0] ? 'category' : 'all', ref: categories[0]?.slug, depth: 0 }]);

  if (!flat.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Je winkel toont nu automatisch je hoofdcategorieën in het menu. Wil je zelf kiezen wat erin staat, in welke volgorde, met submenu's?</p>
        <Button type="button" className="w-full" onClick={startFromCategories}>Menu zelf samenstellen</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flat.map((f, i) => (
        <div key={f.id} className={cn('space-y-2 rounded-lg border p-3', f.depth === 1 && 'ml-6 border-dashed')}>
          <div className="flex items-center gap-1">
            {f.depth === 1 ? <CornerDownRight className="h-4 w-4 text-muted-foreground" /> : null}
            <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} className="h-9" aria-label="Naam in het menu" />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Omhoog"><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={i === flat.length - 1} onClick={() => move(i, 1)} aria-label="Omlaag"><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => set(flat.filter((_, j) => j !== i))} aria-label="Verwijderen"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={f.type} onValueChange={(t) => {
              const type = t as MenuItem['type'];
              const ref = type === 'category' ? categories[0]?.slug : type === 'page' ? pages[0]?.slug : type === 'legal' ? 'contact' : type === 'url' ? '' : undefined;
              update(i, { type, ref });
            }}>
              <SelectTrigger className="h-9" aria-label="Soort link"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            {f.type === 'category' ? (
              <Select value={f.ref || ''} onValueChange={(v) => update(i, { ref: v, label: f.label || categories.find((c) => c.slug === v)?.name || '' })}>
                <SelectTrigger className="h-9" aria-label="Categorie"><SelectValue placeholder="Kies…" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.parent_id ? '— ' : ''}{c.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : f.type === 'page' ? (
              <Select value={f.ref || ''} onValueChange={(v) => update(i, { ref: v })}>
                <SelectTrigger className="h-9" aria-label="Pagina"><SelectValue placeholder={pages.length ? 'Kies…' : 'Nog geen pagina’s'} /></SelectTrigger>
                <SelectContent>{pages.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            ) : f.type === 'legal' ? (
              <Select value={f.ref || 'contact'} onValueChange={(v) => update(i, { ref: v })}>
                <SelectTrigger className="h-9" aria-label="Juridische pagina"><SelectValue /></SelectTrigger>
                <SelectContent>{LEGAL.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            ) : f.type === 'url' ? (
              <Input value={f.ref || ''} onChange={(e) => update(i, { ref: e.target.value })} placeholder="https://… of /pad" className="h-9" aria-label="Link" />
            ) : <span />}
          </div>
          {i > 0 ? (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => update(i, { depth: f.depth === 1 ? 0 : 1 })}>
              {f.depth === 1 ? <><Undo2 className="mr-1 inline h-3 w-3" />Terug naar hoofdniveau</> : 'Onder het item erboven zetten (submenu)'}
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={add}><Plus className="mr-1.5 h-4 w-4" />Item toevoegen</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>Automatisch menu</Button>
      </div>
    </div>
  );
}
