// AI-AGENT-2 — een lijst of top uit de hulpassistent: compacte tabel + download als CSV.
// De volledige rijen komen van de server (event `sellqo_table`); het model vat enkel samen.
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export interface AITable {
  title: string;
  columns: string[];
  rows: unknown[][];
}

const cell = (v: unknown) => (v == null ? '' : typeof v === 'boolean' ? (v ? '✓' : '—') : String(v));

/** CSV met ; als scheidingsteken (Excel in BE/NL) en BOM voor accenten. */
export function toCsv(table: AITable): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [table.columns, ...table.rows].map((r) => r.map(esc).join(';')).join('\n');
}

export function AITableCard({ table }: { table: AITable }) {
  const { t } = useTranslation();
  const download = () => {
    const blob = new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sellqo-${table.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const shown = table.rows.slice(0, 8);
  return (
    <div className="mt-2 rounded-lg border bg-background p-2 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-medium">{table.title}</p>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={download}>
          <Download className="mr-1 h-3.5 w-3.5" />CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>{table.columns.map((c) => <th key={c} className="px-1 py-0.5 text-left font-medium text-muted-foreground">{t(`admin.help.aiTable.${c}`, { defaultValue: c })}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-t">{r.map((v, k) => <td key={k} className="px-1 py-0.5 whitespace-nowrap">{cell(v)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > shown.length ? (
        <p className="mt-1 text-muted-foreground">{t('admin.help.aiTable.more', { count: table.rows.length - shown.length })}</p>
      ) : null}
    </div>
  );
}
