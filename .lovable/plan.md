

## Fix: Producten zonder voorraadregistratie tonen als "Uitverkocht"

### Probleem
Wanneer een product `track_inventory = false` heeft (voorraad wordt niet bijgehouden), wordt het toch als "Uitverkocht" getoond als `stock = 0`. Dit is fout -- zulke producten moeten altijd als "op voorraad" worden behandeld.

### Wat al goed werkt
De webshop-pagina's (productoverzicht, productdetail, quick view) berekenen `in_stock` al correct:
```
in_stock = !product.track_inventory || product.stock > 0
```

### Wat gerepareerd moet worden

**1. Google Product Feed** (`supabase/functions/generate-product-feed/index.ts`, regel 157)

Nu:
```
product.stock > 0 ? 'in_stock' : 'out_of_stock'
```
Wordt:
```
(!product.track_inventory || product.stock > 0) ? 'in_stock' : 'out_of_stock'
```

**2. Admin voorraadfilter** (`src/pages/admin/Products.tsx`, regels 119-121)

Nu filtert het puur op `stock`-waarde. Producten zonder voorraadregistratie moeten:
- Altijd door het `in_stock` filter komen
- Nooit verschijnen bij `out_of_stock` of `low_stock`

### Scope
- 2 bestanden aangepast
- Geen database-wijzigingen nodig
