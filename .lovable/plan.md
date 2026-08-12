# TOAST-UNIFY-1 — één toast-systeem op Sonner 2.x met naar-boven wegswipen

## Doelversie
`sonner@2.0.8` (huidige npm `latest`; geïnstalleerd nu 1.7.4). `@radix-ui/react-toast` wordt verwijderd uit `package.json`.

## A. Upgrade-impact Sonner 2.x

### A1. Wat er in v2 verandert en de styling raakt
- v2 herwerkt de DOM/CSS-variabelen van de toast (offsets als `--offset-top/right/bottom/left`, aparte mobile-offsets, nieuwe swipe-datastates). De `toast()`-API zelf blijft gelijk.
- De huidige wrapper leunt op arbitrary-selectors `group-[.toaster]:...` en `group-[.toast]:...`. Die werken alleen zolang de wrapper zelf `className="toaster group"` zet en de toast-classname `toast` bevat — fragiel, en ze botsen met `richColors` (dat eigen achtergrond/tekst zet, die onze `bg-background`-override platslaat).
- Aanpak: de `group-[...]`-ketens vervangen door directe Tailwind-token-classes in `toastOptions.classNames`, en de kleuren per type expliciet via `classNames.success/error/warning/info`. Zo zijn we niet afhankelijk van v2-interne classnames.

### A2. `richColors` + design tokens
`richColors` zet Sonner's eigen groen/rood/amber, die niet uit onze tokens komen en in dark mode/storefront-light kunnen botsen. Voorstel: `richColors` aanzetten voor type-differentiatie, maar de kleuren overschrijven met semantische tokens per type (`success`, `destructive`, `warning`, `info`) in `classNames`. Als `--success`/`--warning` nog niet in `src/index.css` staan, worden die toegevoegd (HSL, light + dark) — de enige CSS-toevoeging in dit plan.

### A3. Capacitor safe-area
Er is nu **geen** safe-area voorziening: `src/index.css` en `tailwind.config.ts` bevatten geen `env(safe-area-inset-*)`, en `index.html` mist `viewport-fit=cover` (zonder die vlag levert `env()` op iOS 0 op). Daarom:
- `index.html`: viewport-meta → `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- `src/index.css`: `--safe-top: env(safe-area-inset-top, 0px);` in `:root`.
- `<Sonner>`: `offset={{ top: '16px' }}` en `mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: '8px', right: '8px' }}`, zodat toasts op native onder notch/statusbar vallen.

### A4. ForcedLightMode
`src/components/ForcedLightMode.tsx` forceert via next-themes `setTheme('light')`, dus de `html`-class wordt echt `light`. Onze wrapper leest `useTheme()` en geeft dat door aan Sonner; alle kleuren komen uit CSS-tokens die met de html-class meeschakelen. Er is dus **geen** context-specifieke config nodig; storefront-toasts thema-en automatisch light.

### A5. Voorgestelde `src/components/ui/sonner.tsx`
```tsx
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster"
      position="top-center"
      swipeDirections={["top"]}
      closeButton
      richColors
      visibleToasts={3}
      offset={{ top: "16px" }}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        left: "8px",
        right: "8px",
      }}
      toastOptions={{
        classNames: {
          toast: "bg-background text-foreground border border-border shadow-lg",
          title: "text-foreground font-medium",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          closeButton: "bg-background text-foreground border-border",
          success: "border-success/40 [&_[data-icon]]:text-success",
          error: "border-destructive/40 [&_[data-icon]]:text-destructive",
          warning: "border-warning/40 [&_[data-icon]]:text-warning",
          info: "border-primary/40 [&_[data-icon]]:text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
```

## B. Migratiestrategie shadcn → Sonner — **aanbeveling: Optie 1 (shim)**

### B1. Gemeten veldgebruik (basis voor het advies)
Scan over alle 97 bestanden die `@/hooks/use-toast` importeren, met parsing van elke `toast({ ... })`-call (452 calls):
- `title`: 452
- `description`: 248
- `variant`: 162 — waarvan `destructive` 232 keer voorkomt en `'default'` 2 keer, plus 2 ternary's die uitsluitend tussen `destructive` en `default` kiezen
- **geen enkele** `action`, `duration`, `id` of andere key
- **geen** consumer gebruikt `dismiss` of `toasts` uit `useToast()`; alle 97 destructureren enkel `{ toast }`
- `ToastAction`/`@radix-ui/react-toast` wordt buiten `src/components/ui/toast.tsx` nergens gebruikt
- `@/components/ui/toaster` wordt alleen in `src/App.tsx` geïmporteerd

Conclusie: de shim dekt 100% van het feitelijke gebruik. Optie 2 (452 call-sites herschrijven) levert geen functionele winst en veel meer regressierisico. **Optie 1 wordt aanbevolen**, met de shim expliciet als deprecated legacy-adapter gemarkeerd zodat nieuwe code direct `sonner` gebruikt.

### B2. Voorgestelde `src/hooks/use-toast.ts` (shim)
```ts
/**
 * DEPRECATED legacy adapter. Nieuwe code: `import { toast } from "sonner"`.
 * Houdt de oude shadcn-API (title/description/variant) in leven bovenop Sonner,
 * zodat bestaande call-sites niet hoeven te wijzigen.
 */
import { toast as sonnerToast } from "sonner";

type LegacyToastProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | null;
  duration?: number;
  action?: React.ReactNode;
};

function toast({ title, description, variant, duration, action }: LegacyToastProps) {
  const message = title ?? description ?? "";
  const options = {
    description: title ? description : undefined,
    duration,
    action,
  } as Parameters<typeof sonnerToast>[1];

  const id =
    variant === "destructive"
      ? sonnerToast.error(message as string, options)
      : sonnerToast(message as string, options);

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: () => {}, // niet in gebruik in dit project
  };
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] as never[], // compat-stub, geen consumers
  };
}

export { useToast, toast };
```
Gedrag: `variant: 'destructive'` → `toast.error`, overig → neutrale `toast`; `title` wordt hoofdtekst, `description` subtekst; calls met alleen `description` vallen terug op de description als hoofdtekst.

### B3. Uitfaseren Radix-stack
Na de shim: `src/components/ui/toaster.tsx` en `src/components/ui/toast.tsx` verwijderen, `<Toaster />` + import uit `src/App.tsx` halen (`<Sonner />` blijft als enige), en `@radix-ui/react-toast` uit `package.json`.

## C. Toast-limiet & dedup
Advies: **niet** terug naar hard `max 1`, maar `visibleToasts={3}`. Bulk-operaties (bulk-updates, imports, CSV) vuren meerdere toasts; met limiet 1 verdwijnen fouten ongezien, met ongelimiteerde stack vult top-center het hele mobiele scherm. Drie is de middenweg; Sonner queueët de rest. Geen eigen dedup-laag: call-sites die identieke berichten willen samenvoegen kunnen `toast(msg, { id })` gebruiken.

## D. Scope en verificatie

### Geraakte bestanden
- `package.json` — `sonner` → 2.0.8, `@radix-ui/react-toast` verwijderen
- `src/components/ui/sonner.tsx` — nieuwe config (A5)
- `src/hooks/use-toast.ts` — vervangen door shim (B2)
- `src/components/ui/toaster.tsx` — **verwijderen**
- `src/components/ui/toast.tsx` — **verwijderen**
- `src/App.tsx` — `<Toaster />` + import weg
- `src/index.css` — `--safe-top` + evt. `--success`/`--warning` tokens (light + dark)
- `index.html` — `viewport-fit=cover`
- `docs/role-audit.md` + changelog-entry (`2026.08ak`, 4 talen) volgens de vaste release-werkwijze

Buiten scope: de 156 bestanden met `import { toast } from 'sonner'` blijven **ongewijzigd** (API v1→v2 compatibel), en de 97 shadcn-call-sites blijven **ongewijzigd** dank zij de shim.

### Verificatie
1. Typecheck groen (let op resterende imports van `@/components/ui/toast(er)`).
2. `rg` bevestigt nul verwijzingen naar `@radix-ui/react-toast` en `ui/toaster`.
3. Playwright: success-, error-, warning-, `toast.loading` en `toast.promise` triggeren; screenshots in dark en light.
4. Storefront-route onder `ForcedLightMode`: toast leesbaar in light.
5. Mobiel viewport (390x844) met gesimuleerde safe-area: toast onder de statusbar, swipe-omhoog sluit hem (drag via `page.mouse`).
6. Legacy-pad: één `toast({ title, description, variant: 'destructive' })` call-site in de UI triggeren en controleren dat die als rode error-toast met subtekst verschijnt.