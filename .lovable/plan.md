

# Fix: OAuth in nieuw tabblad + "Credentials wijzigen" werkt niet

## Probleem 1: OAuth navigeert weg uit SellQo

De "Verbind met Facebook" knop gebruikt `window.location.href = data.authUrl`, waardoor je uit SellQo wordt genavigeerd. Na autorisatie (of bij een fout zoals "Ongeldige app-ID") zit je op Facebook en moet je zelf terug navigeren.

**Oplossing:** Gebruik `window.open(data.authUrl, '_blank')` zodat Facebook in een nieuw tabblad opent en SellQo open blijft staan.

## Probleem 2: "Credentials wijzigen" knop doet niets

De knop zet `step` naar `'credentials'`, maar regel 64 overschrijft dit meteen:

```
const effectiveStep = step === 'credentials' && existingCredentials ? 'authorize' : step;
```

Omdat `existingCredentials` bestaat, springt het altijd terug naar `'authorize'`.

**Oplossing:** Een `isEditingCredentials` state toevoegen. De `effectiveStep` logica checkt deze flag zodat je wel terug kunt naar het credentials formulier. Het formulier wordt dan voorgevuld met het bestaande App ID (secret moet opnieuw ingevuld worden).

## Technische wijzigingen

### Bestand: `src/components/admin/marketplace/MetaConnectWizard.tsx`

1. **Nieuwe state**: `const [isEditingCredentials, setIsEditingCredentials] = useState(false);`

2. **effectiveStep logica aanpassen**:
   ```typescript
   const effectiveStep = step === 'credentials' && existingCredentials && !isEditingCredentials
     ? 'authorize'
     : step;
   ```

3. **OAuth in nieuw tabblad**:
   ```typescript
   // Was: window.location.href = data.authUrl;
   window.open(data.authUrl, '_blank');
   toast.info('Facebook autorisatie geopend in een nieuw tabblad.');
   ```

4. **"Credentials wijzigen" knop**:
   ```typescript
   onClick={() => {
     setIsEditingCredentials(true);
     setStep('credentials');
     setAppId(existingCredentials?.client_id || '');
     setAppSecret('');
   }}
   ```

5. **Na opslaan credentials**: `setIsEditingCredentials(false)` resetten zodat de flow weer normaal doorloopt.

### Resultaat
- Facebook OAuth opent in een **nieuw tabblad** -- SellQo blijft open
- "Credentials wijzigen" toont het formulier met het bestaande App ID voorgevuld
- Na opslaan gaat de wizard netjes door naar stap 2

