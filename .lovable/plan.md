

# Fix: Meta credentials foutmelding wordt niet getoond

## Oorzaak

Het probleem zit in hoe de Supabase JS client non-2xx responses afhandelt. Wanneer de edge function een 400 teruggeeft:
- `error` wordt een `FunctionsHttpError` object
- `data` wordt **null** (niet de response body)
- De response body (met `missingConfig: true`) zit verstopt in het `error` object zelf

Daardoor is `data` altijd `null` bij een fout, en wordt `errorData?.missingConfig` nooit `true`. De code valt door naar `throw error`, wat de generieke melding "Edge Function returned a non-2xx status code" toont.

## Oplossing

### Bestand: `src/components/admin/marketplace/MessagingChannelList.tsx`

De error handling aanpassen om de response body uit het `FunctionsHttpError` object te halen via `error.context.json()`:

```typescript
if (error) {
  try {
    const errorBody = await error.context?.json?.();
    if (errorBody?.missingConfig) {
      toast.error(
        'Meta App credentials niet geconfigureerd. Ga naar Instellingen → API Credentials om je Meta App ID en Secret in te voeren.',
        { duration: 8000 }
      );
      return;
    }
  } catch {}
  throw error;
}
```

Dit extraheert de JSON body uit de error response, checkt op `missingConfig`, en toont de juiste melding. Als het geen config-fout is, wordt de error gewoon doorgegeven.

Slechts 1 bestand wordt gewijzigd, geen andere aanpassingen nodig.

