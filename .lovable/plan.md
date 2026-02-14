
# Storefront Navigatie Redesign: Van Tabs naar Sidebar Navigator

## Het Probleem

De huidige 7 tabs in een `grid-cols-7` balk zien er krap en rommelig uit. Op smaller schermen zijn de labels zelfs verborgen (`hidden sm:inline`). Samen met de Design Studio (die al z'n eigen accordion-navigatie heeft) voelt het als dubbele navigatie.

## De Oplossing: Verticale Sidebar Navigatie

Vervang de horizontale tabs door een **verticale sidebar links** met de 7 secties als navigatie-items. De content verschijnt rechts. Dit is consistent met hoe de Design Studio al werkt (links navigatie, rechts content) en schaalt veel beter.

```text
+--------------------------------------------------+
| Header: Webshop  [Live] [Preview] [Publiceren]   |
+--------------------------------------------------+
| Status Card (huidige thema info)                  |
+-----------+--------------------------------------+
| Nav       | Content                              |
|           |                                      |
| * Theme   | (ThemeCustomizer / HomepageBuilder /  |
|   Homepage|  StorefrontPagesManager / etc.)       |
|   Pagina's|                                      |
|   Reviews |                                      |
|   Juridisch                                      |
|   Functies|                                      |
|   Instell.|                                      |
+-----------+--------------------------------------+
```

## Ontwerp Details

- **Navigatie-items**: Verticale lijst met icoon + label, actief item krijgt een `bg-muted` highlight en een links accent-border (2px primary)
- **Compact**: Elk item is een simpele button, geen Card of extra wrapper
- **Responsive**: Op mobile valt de sidebar weg en wordt het een horizontale scrollbare strip (vergelijkbaar met de huidige tabs maar dan als pills)
- **Status Card verwijderen**: De losse thema-info Card boven de tabs is overbodig nu de Design Studio al een inline ThemeGallery heeft. Dit bespaart verticale ruimte.

## Technische Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/Storefront.tsx` | Vervang `Tabs`/`TabsList`/`TabsTrigger` door een custom sidebar-navigatie layout met `useState` voor actieve sectie. Verwijder de Status Card. Desktop: sidebar links + content rechts. Mobile: horizontale scrollbare nav-strip. |

### Implementatie

De Radix Tabs worden vervangen door een simpele `useState('theme')` + conditionele rendering:

- **Desktop** (`md:` en groter): Twee-kolommen grid met een smalle linkerkolom (w-48) voor de navigatie-knoppen en de rest voor content
- **Mobile**: Horizontale scrollbare strip met pill-buttons (`overflow-x-auto flex gap-2`)
- Navigatie-items: `button` elementen met `cn()` voor actief/inactief styling
- Content: simpele conditionele rendering (`activeTab === 'theme' && <ThemeCustomizer />`)

Dit is een relatief kleine wijziging -- alleen `Storefront.tsx` wordt aangepast. De onderliggende componenten (ThemeCustomizer, HomepageBuilder, etc.) blijven ongewijzigd.
