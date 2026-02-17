
# Fix: Conversatie-groepering en preview-layout

## Probleem 1: Emails worden onterecht samengevoegd

De huidige grouping-logica in `useInbox.ts` (regel 235) gebruikt:
```
customer_id || from_email || to_email
```

Dit betekent dat:
- Alle **uitgaande** emails zonder klant worden gegroepeerd op `from_email` (altijd `noreply@sellqo.app`) -- dus alles in 1 gesprek
- Alle **inkomende** emails van dezelfde afzender worden samengevoegd, ook als het over totaal andere onderwerpen gaat

### Oplossing

De grouping-key aanpassen zodat berichten worden gegroepeerd op **contactpersoon + genormaliseerd onderwerp**:

- **Met `customer_id`**: groepeer op `customer_id` + genormaliseerd onderwerp (zonder Re:/Fw: prefixes)
- **Zonder `customer_id` (outbound)**: groepeer op `to_email` + genormaliseerd onderwerp
- **Zonder `customer_id` (inbound)**: groepeer op `from_email` + genormaliseerd onderwerp

Dit zorgt ervoor dat twee emails naar dezelfde persoon met verschillende onderwerpen als aparte gesprekken verschijnen.

### Bestand: `src/hooks/useInbox.ts`

Wijziging in de `conversations` useMemo (rond regel 230-238):

```text
Huidige code:
  const key = msg.customer_id || msg.from_email || msg.to_email || 'unknown';

Nieuwe code:
  // Normaliseer subject voor threading
  const normalizedSubject = (msg.subject || '')
    .replace(/^(Re:|Fw:|Fwd:)\s*/gi, '')
    .trim()
    .toLowerCase();
  
  // Groepeer op contact + onderwerp
  const contactKey = msg.customer_id 
    || (msg.direction === 'outbound' ? msg.to_email : msg.from_email) 
    || 'unknown';
  const key = `${contactKey}::${normalizedSubject || 'no-subject'}`;
```

---

## Probleem 2: Preview-layout in de conversatielijst

De huidige layout zet afzender en tijd naast elkaar op dezelfde regel, waardoor de afzendernaam wordt afgeknipt. De gewenste layout is:

```text
+------------------------------------------+
| [Avatar]  Afzendernaam        [icon] 3m   |
|           Onderwerp van het bericht       |
|           Preview van de inhoud...        |
+------------------------------------------+
```

Naar (volle breedte per regel):

```text
+------------------------------------------+
| [Avatar]                      [icon] 3m   |
| Afzendernaam                              |
| Onderwerp van het bericht                 |
| [check] Preview van de inhoud...          |
+------------------------------------------+
```

### Bestand: `src/components/admin/inbox/ConversationItem.tsx`

De layout wordt aangepast:
- **Regel 1**: Avatar links, kanaal-icoon + tijd rechts
- **Regel 2**: Afzendernaam volle breedte (met marketplace badges)
- **Regel 3**: Onderwerp volle breedte
- **Regel 4**: Preview tekst volle breedte

Het avatar-blok blijft compact bovenaan, en de tekst-inhoud neemt de volledige breedte in beslag daaronder.

---

## Technische samenvatting

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useInbox.ts` | Grouping-key aanpassen naar contact + genormaliseerd onderwerp |
| `src/components/admin/inbox/ConversationItem.tsx` | Layout herschikken: afzender, onderwerp en preview elk op volle breedte |

Geen database wijzigingen nodig.
