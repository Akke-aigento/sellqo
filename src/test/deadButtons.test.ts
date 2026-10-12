import { describe, expect, it } from 'vitest';
import { findDeadButtons } from '../../scripts/check-dead-buttons.mjs';

const dead = (src: string) => (findDeadButtons(src) as unknown[]).length;

describe('APP-CLEAN-2 check-dead-buttons', () => {
  it('vindt een knop zonder actie', () => {
    expect(dead('<Button variant="outline">Export</Button>')).toBe(1);
    expect(dead('<DropdownMenuItem>Sync Nu</DropdownMenuItem>')).toBe(1);
  });
  it('vindt een lege onClick', () => {
    expect(dead('<Button onClick={() => {}}>x</Button>')).toBe(1);
  });
  it('laat werkende knoppen met rust', () => {
    expect(dead('<Button onClick={go}>x</Button>')).toBe(0);
    expect(dead('<Button asChild><Link to="/a">x</Link></Button>')).toBe(0);
    expect(dead('<Button disabled>x</Button>')).toBe(0);
    expect(dead('<Button type="submit">x</Button>')).toBe(0);
    expect(dead('<DialogTrigger asChild>\n  <Button>x</Button>\n</DialogTrigger>')).toBe(0);
    expect(dead('<Link to="/a">\n  <Button>x</Button>\n</Link>')).toBe(0);
    expect(dead('trigger={\n  <Button>x</Button>\n}')).toBe(0);
    expect(dead(' * <Button>Bewerken</Button>')).toBe(0);
  });
  it('telt disabled={false} niet als uitgeschakeld', () => {
    expect(dead('<Button disabled={false}>x</Button>')).toBe(1);
  });
});
