

## Fix: Bulk actiebalk past niet mooi op mobiel

### Probleem
De footer in bulk-modus probeert alles op één regel te proppen: X-knop + "2 geselecteerd" + meerdere actieknoppen. Op smalle schermen wordt dit afgesneden of ziet het er gedrongen uit.

### Oplossing
De bulk-actiebalk compacter en mooier maken:

**`src/components/admin/AdminBottomNav.tsx`**:
- Actieknoppen tonen als **icon-only** met een kleine label eronder (zelfde stijl als de normale navigatie-items), zodat ze gelijkmatig verdeeld worden
- "2 geselecteerd" korter weergeven als "2" naast het X-icoon
- `justify-around` gebruiken voor gelijkmatige verdeling net als de normale nav
- Safe area padding toevoegen voor iOS (`pb-safe`) via `env(safe-area-inset-bottom)`
- Hoogte vergroten naar `h-16` om ruimte te geven aan icon + label layout

Layout wordt:

```text
[ ✕ 2 ]  [ 📦 Verzonden ]  [ ✓ Afgeleverd ]  [ ⊘ Annuleer ]
```

Elk item verticaal gecentreerd met icon boven label, net als de normale nav-items — consistent en ruimte-efficiënt.

### Bestanden
- `src/components/admin/AdminBottomNav.tsx` — bulk-modus layout herstructureren

