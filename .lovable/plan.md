

## Platform Docs: Bundel Rendering Prompt toevoegen

### Wat
Een nieuw documentatie-artikel toevoegen aan **Platform Docs** met een kant-en-klare prompt voor custom frontends om bundelproducten correct te renderen.

### Aanpak

**Database migratie — insert doc_category + doc_article**

1. **Categorie aanmaken** (als die nog niet bestaat): "Custom Frontend Prompts" met `doc_level = 'platform'`

2. **Artikel aanmaken**: "Bundel Product Rendering" met de volledige prompt-inhoud:
   - API response structuur voor bundels (`product_type`, `bundle_items`, `bundle_individual_total`, `bundle_savings`, `bundle_pricing_model`)
   - Per bundle item: `product_id`, `quantity`, `customer_can_adjust`, `min_quantity`, `max_quantity`, `sort_order`, en genest `product` object met `name`, `slug`, `price`, `image`, `in_stock`
   - Component-logica: productenlijst met afbeelding, naam, stukprijs, subtotaal
   - Aanpasbare aantallen wanneer `customer_can_adjust === true` met min/max grenzen
   - Dynamische totaalprijs herberekening
   - Kortingsbadge met `bundle_savings`
   - Originele vs bundelprijs vergelijking
   - Voorbeeldcode voor React component

### Geen code-wijzigingen
Alleen een migratie die data insert in bestaande `doc_categories` en `doc_articles` tabellen.

