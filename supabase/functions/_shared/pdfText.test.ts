// PDF-EMOJI-1 — elke PDF-generator moet emoji, Cyrillisch, CJK en typografische
// tekens overleven. Unit-tests op de sanitiser + een echte pdf-lib-render.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { hardenPdfFont, pdfSafeText, WINANSI_CODEPOINTS, wrapTextToWidth } from "./pdfText.ts";

const NASTY = [
  "Bedankt 🎉 voor je bestelling!",
  "👨‍👩‍👧‍👦 Familiepakket 🇧🇪 1️⃣ 👍🏽",
  "Анастасія Брюхович",
  "Київ, вул. Хрещатик 22",
  "Сергей Ёлкин, ул. Пушкина",
  "東京都 渋谷区 / 서울 / مرحبا / שלום",
  "„Citaat” ‘enkel’ – streepje — lang … € ™ •",
  "Łódź, Kraków, București, Şişli, Ørsted, Œuvre, ß",
  "tab\there\r\nnieuwe regel​­﻿",
  "\ud83d", // losse surrogaat (bv. na .substring())
  "smal nbsp en thin　ideografisch",
  "pijl → ≥ ≤ ✓ №5",
];

function encodable(s: string): boolean {
  for (const ch of s) {
    if (ch === "\n") continue;
    if (!WINANSI_CODEPOINTS.has(ch.codePointAt(0)!)) return false;
  }
  return true;
}

Deno.test("pdfSafeText: resultaat is altijd WinAnsi-encodeerbaar", () => {
  for (const s of NASTY) {
    const out = pdfSafeText(s);
    assert(encodable(out), `niet encodeerbaar: ${JSON.stringify(out)}`);
  }
});

Deno.test("pdfSafeText: encodeerbare tekst blijft byte-voor-byte gelijk", () => {
  const s = "Café Zoë – „Grüße” 12,50 € • Ñandú … ‘ok’";
  assertEquals(pdfSafeText(s), s);
  assertEquals(pdfSafeText(null), "");
  assertEquals(pdfSafeText(undefined), "");
  assertEquals(pdfSafeText(42), "42");
});

Deno.test("pdfSafeText: emoji verdwijnen zonder dubbele spatie", () => {
  assertEquals(pdfSafeText("Bedankt 🎉 voor je bestelling!"), "Bedankt voor je bestelling!");
  assertEquals(pdfSafeText("🎉 Feest"), "Feest");
  assertEquals(pdfSafeText("Top👍🏽!"), "Top!");
  assertEquals(pdfSafeText("België 🇧🇪"), "België ");
  assertEquals(pdfSafeText("Gezin 👨‍👩‍👧‍👦 pakket"), "Gezin pakket");
});

Deno.test("pdfSafeText: Oekraïens en Russisch worden getranslitereerd", () => {
  assertEquals(pdfSafeText("Анастасія Брюхович"), "Anastasiia Briukhovych");
  assertEquals(pdfSafeText("Київ"), "Kyiv");
  assertEquals(pdfSafeText("Юлія Щербак"), "Yuliia Shcherbak");
  assertEquals(pdfSafeText("ЖИТОМИР"), "ZHYTOMYR");
  assertEquals(pdfSafeText("Григорий Ёлкин"), "Grigoriy Yolkin");
});

Deno.test("pdfSafeText: accenten buiten WinAnsi, CJK en tekens", () => {
  // ó zit in WinAnsi en blijft; Ł, ź, ș, Ş, ş niet.
  assertEquals(pdfSafeText("Łódź, București, Şişli"), "Lódz, Bucuresti, Sisli");
  assertEquals(pdfSafeText("東京"), "??");
  assertEquals(pdfSafeText("a b c"), "a b c");
  assertEquals(pdfSafeText("x​y­z"), "xyz");
  assertEquals(pdfSafeText("pijl → ≥ №5"), "pijl -> >= No.5");
  assertEquals(pdfSafeText("a\tb\r\nc"), "a b\nc");
  assertEquals(pdfSafeText("a\nb", { keepNewlines: false }), "a b");
});

Deno.test("hardenPdfFont: echte pdf-lib-render gooit nooit", async () => {
  const doc = await PDFDocument.create();
  const fonts = [
    hardenPdfFont(await doc.embedFont(StandardFonts.Helvetica)),
    hardenPdfFont(await doc.embedFont(StandardFonts.HelveticaBold)),
    hardenPdfFont(await doc.embedFont(StandardFonts.HelveticaOblique)),
  ];
  // Idempotent: twee keer harden wikkelt niet dubbel.
  assert(hardenPdfFont(fonts[0]) === fonts[0]);
  const page = doc.addPage([595, 842]);
  let y = 800;
  for (const font of fonts) {
    for (const s of NASTY) {
      page.drawText(s, { x: 40, y, size: 10, font });
      page.drawText(s, { x: 40, y: y - 12, size: 10, font, maxWidth: 120 });
      assert(font.widthOfTextAtSize(s, 10) >= 0);
      for (const line of wrapTextToWidth(s, font, 10, 80)) page.drawText(line, { x: 300, y, size: 10, font });
      y -= 20;
      if (y < 60) { y = 800; doc.addPage([595, 842]); }
    }
  }
  const bytes = await doc.save();
  assert(bytes.length > 1000);
});

Deno.test("zonder harden crasht pdf-lib wél (bewijs dat de test iets meet)", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let threw = false;
  try {
    font.encodeText("Bedankt 🎉");
  } catch {
    threw = true;
  }
  assert(threw);
});
