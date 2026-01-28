
# Fix: Gebruikers Kunnen Niet Inloggen/Uitloggen

## Probleem
Wanneer een gebruiker al ingelogd is (sessie in browser) en op "Inloggen" klikt:
1. `/auth` pagina redirect direct naar `/admin` (Auth.tsx regel 43-45)
2. `/admin` toont de fullscreen OnboardingWizard
3. Er is geen uitlog-knop zichtbaar → gebruiker zit vast

## Oplossing

### 1. Auth Page: Keuze-scherm voor Ingelogde Gebruikers
**Bestand:** `src/pages/Auth.tsx`

In plaats van automatisch redirecten naar `/admin`, toon een keuze-scherm:
- "Naar mijn dashboard" → ga naar /admin
- "Wissel van account" → log uit en toon login formulier

```text
Huidige logica:
useEffect(() => {
  if (user) {
    navigate('/admin');  // <-- Probleem: geen keuze
  }
}, [user, navigate]);

Nieuwe logica:
- Nieuwe state: showAccountSwitch (default false)
- Als user ingelogd is EN showAccountSwitch=false → toon keuze-scherm
- Als user kiest "Wissel account" → signOut() + setShowAccountSwitch(true)
- Als user kiest "Naar dashboard" → navigate('/admin')
```

### 2. Onboarding Wizard: Uitlog-knop Toevoegen
**Bestand:** `src/components/onboarding/OnboardingWizard.tsx`

Voeg naast de "Overslaan" knop een "Uitloggen" optie toe:
- Positie: In de header of footer van de wizard
- Actie: `signOut()` + navigeer naar `/auth`
- Tekst: "Ander account gebruiken"

### 3. Resume Dialog: Uitlog-optie Toevoegen
**Bestand:** `src/components/onboarding/ResumeOnboardingDialog.tsx`

Voeg een derde optie toe onder "Verder waar ik was" en "Opnieuw beginnen":
- "Uitloggen / Ander account"
- Dit logt de gebruiker uit en brengt hem naar /auth

---

## Technische Details

### Auth.tsx Wijzigingen

```text
Nieuwe imports:
import { useAuth } from '@/hooks/useAuth';
// (al aanwezig, maar we gebruiken ook signOut)

Nieuwe state:
const [showAccountSwitch, setShowAccountSwitch] = useState(false);

Nieuwe logica (vervang de huidige useEffect):
- Als !user || showAccountSwitch → toon login/register tabs (huidige flow)
- Als user && !showAccountSwitch → toon keuze-component:
  
  <Card>
    <CardHeader>
      <CardTitle>Welkom terug!</CardTitle>
      <CardDescription>
        Je bent ingelogd als {user.email}
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <Button className="w-full" onClick={() => navigate('/admin')}>
        Naar mijn dashboard
      </Button>
      <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
        Wissel van account
      </Button>
    </CardContent>
  </Card>

handleSwitchAccount:
  await signOut();
  setShowAccountSwitch(true);
```

### OnboardingWizard.tsx Wijzigingen

```text
Nieuwe imports:
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

In component:
const { signOut, user } = useAuth();
const navigate = useNavigate();

Nieuwe handler:
const handleLogout = async () => {
  await signOut();
  navigate('/auth');
};

In header (naast "Overslaan" knop), voeg toe:
<Button
  variant="ghost"
  size="sm"
  onClick={handleLogout}
  className="text-muted-foreground hover:text-foreground"
>
  <LogOut className="h-4 w-4 mr-1" />
  Uitloggen
</Button>
```

### ResumeOnboardingDialog.tsx Wijzigingen

```text
Nieuwe prop:
onLogout: () => void;

Nieuwe knop (onder "Opnieuw beginnen"):
<Button 
  variant="ghost" 
  onClick={onLogout}
  className="w-full justify-between text-muted-foreground"
>
  <span>Uitloggen / Ander account</span>
  <LogOut className="h-4 w-4 ml-2" />
</Button>
```

---

## Verwacht Gedrag Na Fix

| Situatie | Actie | Resultaat |
|----------|-------|-----------|
| Niet ingelogd, klik "Inloggen" | - | Login/register scherm |
| Ingelogd, klik "Inloggen" | - | Keuze: Dashboard of Wissel account |
| Ingelogd, kiest "Wissel account" | signOut() | Login formulier |
| In onboarding, wil uitloggen | Klik "Uitloggen" | Naar /auth, uitgelogd |
| In resume dialog, wil uitloggen | Klik "Uitloggen" | Naar /auth, uitgelogd |

---

## Bestanden te Wijzigen
1. `src/pages/Auth.tsx` - Keuze-scherm voor ingelogde users
2. `src/components/onboarding/OnboardingWizard.tsx` - Logout knop in header
3. `src/components/onboarding/ResumeOnboardingDialog.tsx` - Logout optie toevoegen

## Samenvatting
Deze fix zorgt ervoor dat:
- Je ALTIJD op een login-scherm kunt komen
- Je ALTIJD kunt uitloggen, zelfs midden in onboarding
- De flow logisch is zoals bij andere applicaties
