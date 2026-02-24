

## Fix: Categorieën verdwijnen + Logo 2x groter

### Oorzaak categorie-bug (GEVONDEN!)

De `product_categories` tabel **bestaat niet** in de database. De code probeert via `(supabase as any).from('product_categories')` te lezen en schrijven, wat TypeScript-controles omzeilt. Hierdoor:

1. De query in `useProductCategories` faalt stilletjes -- retourneert altijd een lege array
2. Bij opslaan probeert `syncCategories` te schrijven naar een niet-bestaande tabel, wat een fout geeft
3. De product-update zelf slaagt WEL (die schrijft `category_id` naar de `products` tabel), maar de multi-category koppeling gaat verloren

Dit verklaart waarom de bug bleef terugkomen ondanks alle logica-fixes -- het probleem zat in de database, niet in de code.

### Oplossing

**1. Database migratie: `product_categories` tabel aanmaken**

```sql
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- RLS policies
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage product categories"
  ON public.product_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.user_roles ur ON ur.tenant_id = p.tenant_id
      WHERE p.id = product_categories.product_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Public read for active products"
  ON public.product_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_categories.product_id
      AND p.is_active = true
    )
  );

-- Trigger om primaire categorie te promoten bij verwijdering
CREATE OR REPLACE FUNCTION public.promote_primary_category()
RETURNS TRIGGER AS $$
DECLARE v_next_id UUID;
BEGIN
  IF OLD.is_primary THEN
    SELECT id INTO v_next_id FROM public.product_categories
    WHERE product_id = OLD.product_id AND id != OLD.id
    ORDER BY sort_order LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE public.product_categories SET is_primary = true WHERE id = v_next_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promote_primary_on_delete
  AFTER DELETE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION promote_primary_category();

-- Migratie: bestaande category_id data overzetten
INSERT INTO public.product_categories (product_id, category_id, is_primary, sort_order)
SELECT id, category_id, true, 0
FROM public.products
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

**2. Logo 2x groter op cadeaukaarten**

Bestand: `src/components/shared/GiftCardTemplates.tsx`

De huidige logo-afmetingen verdubbelen:
- **Preview**: `max-h-[45%]` verhogen naar `max-h-[60%]` en `max-w-[60%]` naar `max-w-[75%]`
- **Renderer**: `h-20 md:h-24` verhogen naar `h-40 md:h-48` en `max-w-[70%]` naar `max-w-[85%]`

---

### Samenvatting

| Wijziging | Bestand |
|---|---|
| `product_categories` tabel aanmaken + RLS + data migratie | Database migratie |
| Logo afmetingen verdubbelen in preview en renderer | `src/components/shared/GiftCardTemplates.tsx` |

### Resultaat
- Categorieën worden correct opgeslagen en blijven behouden bij bewerken (de tabel bestaat nu daadwerkelijk)
- Bestaande `category_id` data wordt automatisch gemigreerd naar de nieuwe tabel
- Het logo is 2x zo groot en valt direct in het oog op alle cadeaukaart-ontwerpen

