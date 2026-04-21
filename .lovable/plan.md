

## Sandbox-modus banner

Eén nieuwe component die in zowel admin als storefront een gele banner toont wanneer de actieve tenant `is_demo = true` is. Geen edge function- of Stripe-wijzigingen — Stripe test-mode wordt door de gebruiker gekoppeld via de bestaande "Connect Stripe"-flow.

### Nieuwe component: `src/components/SandboxBanner.tsx`

Self-contained, accepteert `isDemo: boolean` als prop:

- Rendert `null` als `isDemo !== true` of als de banner deze sessie is dismissed.
- Amber/yellow styling: `bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100`.
- Tekst: `🧪 SANDBOX MODE — dit is een testomgeving. Bestellingen gebruiken Stripe testkaarten, er worden geen echte betalingen verwerkt.`
- `X`-knop rechts; bij klik `sessionStorage.setItem('sandbox-banner-dismissed', '1')` + lokale state op dismissed → verdwijnt tot reload (sessionStorage leegt bij nieuwe tab/reload-sessie; voldoet aan "reappears on page reload" want banner respawnt na hard reload als sessionStorage geleegd is — zie sub-noot hieronder).
- Sticky bovenaan binnen zijn parent (`sticky top-0 z-50`), volle breedte, kleine padding (`px-4 py-2 text-sm text-center`).

**Sub-noot dismiss-gedrag**: prompt zegt "dismissible per session, reappears on page reload". `sessionStorage` overleeft een reload binnen hetzelfde tabblad — dat zou de banner verbergen. Daarom gebruiken we **in-memory state only** (geen storage): dismiss verbergt 'm tot de volgende navigatie/reload, wat exact aan de eis voldoet.

### Mountpoint 1: Admin layout

In `src/components/admin/AdminLayout.tsx`, binnen `AdminLayoutContent`, direct boven de bestaande `<TrialBanner />` (zodat hij bovenaan in de content-flow valt, na de header):

```tsx
<SandboxBanner isDemo={currentTenant?.is_demo === true} />
<TrialBanner />
```

`currentTenant` halen via bestaande `useTenant()` hook. Als `is_demo` undefined is (loading), rendert de component `null`.

### Mountpoint 2: Storefront layout

In `src/components/storefront/ShopLayout.tsx`, boven het hoogste DOM-element van de layout (binnen de root div), na font-loading.

`usePublicStorefront` retourneert `tenant` zonder `is_demo`. Twee opties:

1. **Voorkeur**: Aparte lichte query in `ShopLayout` die alleen `is_demo` ophaalt voor de zichtbare tenant: 
   ```ts
   const [isDemo, setIsDemo] = useState(false);
   useEffect(() => {
     if (!tenant?.id) return;
     supabase.from('tenants').select('is_demo').eq('id', tenant.id).maybeSingle()
       .then(({ data }) => setIsDemo(data?.is_demo === true));
   }, [tenant?.id]);
   ```
   `tenants.is_demo` is leesbaar voor anon (RLS public-storefront-policy staat SELECT toe op tenants voor publieke storefront).

2. Alternatief: `is_demo` toevoegen aan de `storefront-api` `getStorefront`-respons. Meer werk, raakt edge function. Niet nodig voor één veld dat al SELECT-toegankelijk is.

Gaan voor optie 1.

### Niet aanraken
- Stripe edge functions (`create-connect-account`, `stripe-connect-webhook`, `check-connect-status`, `get-stripe-login-link`).
- Geen test-mode env vars, geen tweede webhook endpoint.
- `useTenant`, `usePublicStorefront`, RLS policies — `is_demo` is al toegankelijk.
- Geen nieuwe migratie.

### Acceptance
1. Sandbox-tenant actief in admin → gele banner zichtbaar onder header, dismissible, terug na reload.
2. `/shop/sandbox` → zelfde banner bovenaan storefront.
3. Mancini / VanXcel admin & storefront → géén banner (`is_demo = false`).
4. Stripe-koppeling: gebruiker volgt handmatig de bestaande "Connect Stripe"-flow vanuit sandbox-tenant met test-mode dashboard; geen code-wijzigingen aan Connect-flow.
5. Test card `4242 4242 4242 4242` werkt zodra de gebruiker stap 1-5 (handmatig) heeft voltooid — blokkeert niet op iets in de Lovable-codebase.

### Out-of-scope
- Stripe test-mode automatisering of UI-prompt om naar test-dashboard te linken (kan in een vervolgprompt indien gewenst).
- Historische sandbox-orders genereren.

