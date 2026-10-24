// KASSA-0 — posSwVersion (ID-05): 1–36 tekens, bij elk FDM-bericht. Wordt per fiscale
// release opgehoogd (zie src/kassa/README.md) en is de versie die in het dossier staat.
// 0.2.0 (PRINT-1): kastickets en afdrukken (src/kassa/print/). 0.3.0 (TAFEL-1): tafels en rekeningen. 0.4.0 (TAFEL-2): afrekenen. 0.4.1: enkel typecorrectie in de simulator (nieuwere TypeScript in de Lovable-build). 0.5.0 (TAFEL-3): toogverkoop, kas in/uit en tellingen, X/Z-rapporten. 0.6.0 (KASSA-0.6): product op/terug en prijs aanpassen op de kassa (eigenaar/verantwoordelijke, audit-spoor), btw-tarieven op de kaart zoals de server. 0.6.1 (KAART-3): de kaart op de kassa volgt de volgorde van de Kaart (categorie, positie, naam).
export const KASSA_SW_VERSION = 'sellqo-kassa-0.6.1';
