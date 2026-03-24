
Doel: de categorie-dropdown in de bulkbewerking écht scrollbaar maken binnen de modal (trackpad + mouse wheel), zonder regressies elders.

1) Root-cause fix: Popover in modal niet meer buiten de dialog scroll-lock renderen
- Bestand: `src/components/ui/popover.tsx`
- `PopoverContent` uitbreiden met een optionele prop (bv. `portalled?: boolean`, default `true`).
- Als `portalled=false`, render `PopoverPrimitive.Content` zonder `PopoverPrimitive.Portal`.
- Reden: de huidige portal-render buiten de dialog veroorzaakt in deze modal-context een wheel/scroll-lock conflict.

2) Bulk categorie-dropdown omzetten naar “in-dialog” popover + echte scroll container
- Bestand: `src/components/admin/products/bulk/BulkBasicTab.tsx`
- Voor deze specifieke dropdown: `PopoverContent` gebruiken met `portalled={false}`.
- De lijst-wrapper vervangen door `ScrollArea` (of vaste hoogte + `overflow-y-auto`) met expliciete hoogte (bv. `h-[280px]`) i.p.v. alleen `max-h`.
- `overscroll-contain` toevoegen op de scroll-container zodat scroll niet “lekt” naar de modal/page.

3) Clipping vermijden in de modal
- Bestand: `src/components/admin/products/ProductBulkEditDialog.tsx`
- `DialogContent` niet langer hard op `overflow-hidden` laten staan als dat de niet-geportalde popover afsnijdt; overflow-beperking op de bestaande interne tabs/scroll-container houden.
- De huidige `min-h-0` chain behouden (die fixte de algemene modal-scroll al).

4) Validatie (gericht op jouw bug)
- Open bulkbewerking → Basis → Categorieën wijzigen → dropdown openen.
- Verifiëren:
  - met trackpad/muiswiel kan je door de volledige categorielijst scrollen;
  - onderliggende modal/body scrollt niet mee;
  - selecteren/deselecteren blijft werken;
  - geen visuele clipping van de dropdown.
- Quick regression check: andere popovers buiten deze modal blijven ongewijzigd gedrag hebben (default `portalled=true`).
