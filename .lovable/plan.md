
# Fix: AI-voorstel toont HTML als opgemaakte tekst

## Probleem
De AI genereert tekst met HTML-opmaak (koppen, lijsten, vetgedrukt), maar deze wordt als platte tekst getoond inclusief de `<h2>`, `<p>`, `<ul>` tags. Dat ziet er lelijk en onleesbaar uit.

## Oplossing
De gegenereerde tekst wordt gerenderd als opgemaakte HTML met de bestaande `prose` styling (dezelfde als bij productbeschrijvingen en help-artikelen). Hierdoor worden koppen, lijsten en andere opmaak netjes weergegeven in het voorstellingsvenster.

---

## Technische Details

### Wijzigingen in `src/components/admin/ai/AIFieldAssistant.tsx`

Twee plekken waar tekst nu als plain text wordt gerenderd, worden aangepast naar `dangerouslySetInnerHTML` met `prose` class:

1. **Enkelvoudig resultaat** (regel 271-273): Van `{result}` naar een `div` met `dangerouslySetInnerHTML` en `prose prose-sm` class
2. **Variaties** (regel 306): Van `<p>{v.text}</p>` naar een `div` met `dangerouslySetInnerHTML` en `prose prose-sm` class

| Regel | Van | Naar |
|---|---|---|
| 271-273 | `<div className="text-sm ...">{result}</div>` | `<div className="prose prose-sm max-w-none dark:prose-invert ..." dangerouslySetInnerHTML={{ __html: result }} />` |
| 306 | `<p className="text-sm mt-1">{v.text}</p>` | `<div className="prose prose-sm max-w-none dark:prose-invert mt-1" dangerouslySetInnerHTML={{ __html: v.text }} />` |

Dit gebruikt hetzelfde prose-patroon als `DocArticleViewer` en de productbeschrijvings-editor, voor een consistent resultaat.
