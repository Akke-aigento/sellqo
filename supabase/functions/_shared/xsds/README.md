# INTERVAT XSD reference

The official XSDs are published by FOD Financiën / SPF Finances:

- VAT declaration (formulier 625): `NewTVA-in_v0_9.xsd` and
  `NewTVA-in_v0_9.xsd` derived `VATConsignment` schema.
- IC client listing (formulier 723): `NewICO-in_v0_7.xsd`.

They live behind the MyMinFin / INTERVAT documentation portal at
<https://finances.belgium.be/fr/E-services/Intervat/documentation-technique>
and require login, so they are not redistributed in this repo.

Deno does not ship a libxml-based XSD validator that is light enough to run
inside an edge function, so the `export-vat-xml` and `export-ic-listing-xml`
functions implement **structural validation mirroring the XSD constraints**
(required fields, decimal/integer formats, VAT-number country prefix rules,
sequence numbers, sums) before returning the document. Any rule that the
real XSD enforces and that the generator could violate is replicated in
`structuralValidate*()`.

If/when a Deno-compatible XSD validator becomes practical, drop the official
`.xsd` files into this directory and wire them through `validateAgainstXsd()`.