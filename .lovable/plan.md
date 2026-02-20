
# Dashboard Layout Fix: Masonry-stijl zonder whitespace

## Kernprobleem

CSS Grid dwingt **gelijke rij-hoogtes** af. Als Action Items (5 items, ~400px hoog) naast Quick Actions (3 knoppen, ~180px hoog) staat, krijgt Quick Actions 220px lege ruimte. Dit probleem bestaat ongeacht hoe je de widgets herschikt -- het is een fundamenteel CSS Grid probleem.

De `h-full` aanpak maakt het erger: korte cards rekken uit tot de hoogte van hun buurman, maar de content vult dat niet.

## Oplossing: CSS Columns masonry-layout

Vervang de `grid` layout door een **CSS columns** layout. Dit werkt als een krant: widgets stapelen verticaal per kolom en er is nooit lege ruimte tussen widgets.

```text
HUIDIGE SITUATIE (Grid):                    NIEUWE SITUATIE (Columns):
+----------+----------+----------+          +----------+----------+----------+
| Health Banner (full)           |          | Health Banner (full)           |
+----------+----------+----------+          +----------+----------+----------+
| Health   | Health   | Today    |          | Health   | Today    | Actions  |
| Cat 1    | Cat 2    |          |          | Cat 1    |          |          |
| Cat 3    | Cat 4    | LIVE NU  |          | Cat 2    | Vandaag  | URGENT   |
| Cat 5    | Cat 6    |          |          | Cat 3    | Stats    | URGENT   |
|          |          | Vandaag  |          +----------+----------+ URGENT   |
|          |          | Stats    |          | Quick    | AI Mktg  |          |
+----------+----------+----------+          | Actions  |          +----------+
| Actions  | Quick    | AI Mktg  |          |          | Credits  | POS      |
| URGENT   | Actions  |          |          +----------+----------+          |
| URGENT   |          | Credits  |          | Market   | Badges             |
| URGENT   |   (lege  |          |          | place    |                     |
| URGENT   |   ruimte)|          |          +----------+--------------------+
| URGENT   |          |          |
+----------+----------+----------+          Geen lege ruimte! Alles sluit aan.
| POS      | Market   |  (LEEG)  |
|          | place    |          |
+----------+----------+----------+
```

## Technische wijzigingen

### 1. `src/components/admin/DashboardGrid.tsx`

De grid `div` vervangen door een columns-based layout:

```typescript
// Was:
<div className="grid gap-4 lg:grid-cols-3">
  {visibleWidgets.map(renderWidget)}
</div>

// Wordt:
<div className="columns-1 md:columns-2 lg:columns-3 gap-4 [column-fill:balance]">
  {visibleWidgets.map(renderWidget)}
</div>
```

De `full`-width widgets (health-banner, badges) worden apart gerenderd, **buiten** de columns layout, zodat ze altijd de volle breedte pakken. De rest gaat in de masonry-kolommen.

Concrete aanpak:
- Split `visibleWidgets` in twee groepen: `fullWidgets` (size === 'full') en `columnWidgets` (rest)
- Render full widgets als gewone block-level elementen
- Render column widgets in de CSS columns container
- `lg`-size widgets (health-categories) krijgen `break-inside: avoid` en `column-span: all` is niet nodig -- ze nemen gewoon 1 kolom in beslag als reguliere items

### 2. `src/components/admin/DashboardWidgetWrapper.tsx`

- Verwijder de `widgetSizeClasses` mapping (niet meer nodig -- geen grid col-spans meer)
- Voeg `break-inside-avoid` toe zodat widgets niet over kolommen breken
- Voeg `mb-4` toe voor verticale spacing tussen widgets in een kolom
- Verwijder `h-full` (widgets bepalen hun eigen hoogte)

```typescript
// Was:
const widgetSizeClasses: Record<WidgetSize, string> = {
  sm: 'lg:col-span-1',
  md: 'lg:col-span-1',
  lg: 'lg:col-span-2',
  full: 'lg:col-span-3',
};

// Wordt: verwijderd. De wrapper krijgt gewoon:
className={cn(
  'break-inside-avoid mb-4',
  isDragging && 'z-50 opacity-75',
  isEditMode && 'relative'
)}
```

### 3. `src/components/admin/DashboardGrid.tsx` - Rendering logica

```typescript
const renderWidget = (widgetId: string) => {
  const Widget = widgetComponents[widgetId];
  const widgetDef = getWidgetById(widgetId);
  if (!Widget || !widgetDef) return null;

  return (
    <DashboardWidgetWrapper
      key={widgetId}
      id={widgetId}
      isEditMode={isEditMode}
    >
      <Widget />
    </DashboardWidgetWrapper>
  );
};

// In de return:
const fullWidgetIds = ['health-banner', 'badges'];
const fullWidgets = visibleWidgets.filter(id => fullWidgetIds.includes(id));
const columnWidgets = visibleWidgets.filter(id => !fullWidgetIds.includes(id));

// Render:
{fullWidgets.filter(id => visibleWidgets.indexOf(id) === 0 || ...).map(renderWidget)}
<div className="columns-1 md:columns-2 lg:columns-3 gap-4">
  {columnWidgets.map(renderWidget)}
</div>
{/* Render trailing full widgets (badges) */}
```

Specifiek wordt de volgorde:
1. Full-width widgets die aan het begin staan (health-banner) -- als gewone divs
2. Alle niet-full widgets in CSS columns masonry layout
3. Full-width widgets die aan het eind staan (badges) -- als gewone divs

### 4. Widget componenten - `h-full` verwijderen

Verwijder `h-full` van alle Card componenten, want widgets moeten hun **eigen natuurlijke hoogte** bepalen:

- `QuickActionsWidget.tsx`: `<Card className="h-full">` wordt `<Card>`
- `TodayWidget.tsx`: `<Card className="h-full">` wordt `<Card>`
- `DashboardPOSWidget.tsx`: alle `<Card className="h-full">` wordt `<Card>`
- `DashboardMarketplaceWidget.tsx`: alle `<Card className="h-full">` wordt `<Card>`
- `HealthActionList.tsx`: alle `<Card className="h-full">` wordt `<Card>`

### 5. `src/config/dashboardWidgets.ts`

De `size` property wordt nu alleen gebruikt om full-width widgets te identificeren. De `widgetSizeClasses` export kan verwijderd worden (niet meer nodig).

### 6. Drag-and-drop compatibiliteit

`rectSortingStrategy` van dnd-kit werkt met columns layout. De DnD blijft functioneel -- gebruikers kunnen widgets herordenen en de masonry layout past zich automatisch aan zonder whitespace.

## Bestanden die wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/DashboardGrid.tsx` | Columns layout, split full/column widgets |
| `src/components/admin/DashboardWidgetWrapper.tsx` | `break-inside-avoid` + `mb-4`, verwijder grid classes |
| `src/components/admin/widgets/QuickActionsWidget.tsx` | Verwijder `h-full` |
| `src/components/admin/widgets/TodayWidget.tsx` | Verwijder `h-full` |
| `src/components/admin/pos/DashboardPOSWidget.tsx` | Verwijder `h-full` |
| `src/components/admin/marketplace/DashboardMarketplaceWidget.tsx` | Verwijder `h-full` |
| `src/components/shop-health/HealthActionList.tsx` | Verwijder `h-full` |
| `src/config/dashboardWidgets.ts` | Verwijder `widgetSizeClasses` export |

## Resultaat

- Widgets sluiten naadloos op elkaar aan, ongeacht hoogte
- Geen lege ruimte meer tussen widgets
- Werkt met elke volgorde die gebruikers instellen via personal views
- Health Banner en Badges blijven volle breedte
- Drag-and-drop blijft werken
