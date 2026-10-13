// Bedrag-invoer die tijdens het typen de tekst bewaart ("2," of "2.5"), zodat een
// komma of punt niet meteen weggepoetst wordt. Leeg = null.
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

const fmt = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));

export function DecimalInput({ value, onChange, className, placeholder, ...rest }: {
  value: number | null; onChange: (v: number | null) => void; className?: string; placeholder?: string; 'aria-label'?: string;
}) {
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text.replace(',', '.'));
    if (parsed !== value) setText(fmt(value));
    // Alleen reageren op een waarde van buitenaf (bv. na opnieuw laden).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input inputMode="decimal" value={text} placeholder={placeholder} className={className} aria-label={rest['aria-label']}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^\d*([.,]\d{0,2})?$/.test(t.trim())) return;
        setText(t);
        onChange(t.trim() === '' ? null : Number(t.replace(',', '.')));
      }} />
  );
}
