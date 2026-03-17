

## Plan: POS bottom nav verbergen + AI Help Widget minimaliseerbaar maken

### 1. Bottom nav verbergen op POS-pagina's

`AdminBottomNav.tsx` — dezelfde route-check toevoegen als de AIHelpWidget al heeft: als het pad begint met `/admin/pos/` of `/kassa/`, return `null`.

### 2. AI Help Widget minimaliseerbaar maken

Nu is de widget volledig verborgen op POS-pagina's en op andere pagina's is het een grote floating button. De gebruiker wil hem kunnen "wegklikken" zodat hij minder in de weg zit.

Aanpak: als de widget open is en je sluit hem, wordt hij geminimaliseerd naar een klein compact icoontje (kleiner dan nu, bijv. `h-8 w-8`) in de hoek. Een extra "verberg"-optie maakt het icoontje helemaal onzichtbaar tot de volgende paginanavigatie of tot de gebruiker de pagina herlaadt.

Simpeler: we maken de floating button **kleiner** (bijv. `h-9 w-9` i.p.v. `h-12 w-12`) en voegen een **dismiss** optie toe — een klein kruisje op de button waarmee je hem kunt verbergen. Hij verschijnt dan weer bij de volgende paginanavigatie.

### Bestanden

| Actie | Bestand |
|-------|---------|
| Wijzig | `src/components/admin/AdminBottomNav.tsx` — POS route-check, return null |
| Wijzig | `src/components/admin/help/AIHelpWidget.tsx` — dismiss/minimize functionaliteit + kleiner formaat |

