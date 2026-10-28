## Resultaat read-only logcontrole: horeca-device-push (28-10-2026, rond 19:53 UTC)

Ik heb niets gewijzigd. Hieronder staan de logs letterlijk.

### Regel `web push failed (`
```
2026-10-28T19:53:23Z ERROR web push failed (400): {"reason":"BadWebPushTopic"}
```

### Andere console.error-regels in dit tijdvenster
Geen. De enige andere regels zijn opstartmeldingen:
```
2026-10-28T19:53:21Z INFO Listening on http://localhost:9999/
2026-10-28T19:53:21Z LOG booted (time: 36ms)
```

### Wat de fout betekent (alleen ter info, geen actie)
De pushdienst weigerde het bericht met HTTP 400 `BadWebPushTopic`. Die fout komt meestal door de header `Topic`: die mag maximaal 32 tekens lang zijn, en alleen URL-veilige base64-tekens (A-Z, a-z, 0-9, `-`, `_`) zijn toegestaan. Ik heb de code niet nagekeken en niets aangepast.

Er is geen vervolgstap gepland. Dit is alleen het verslag.
