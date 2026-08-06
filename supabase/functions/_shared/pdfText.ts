// UX-POLISH-1 (bevinding C) — gedeelde wrap-helper voor PDF-kolommen.
// pdf-lib heeft geen tekstwrap; zonder deze helper werden omschrijvingen
// afgekapt (substring) in factuur- en creditnota-PDF's.

interface WidthFont {
  widthOfTextAtSize: (text: string, size: number) => number;
}

/**
 * Breekt `text` op woordgrenzen in regels die binnen `maxWidth` (punten)
 * passen. Woorden die zelf te lang zijn worden hard gesplitst.
 */
export function wrapTextToWidth(
  text: string,
  font: WidthFont,
  size: number,
  maxWidth: number,
  maxLines = 4,
): string[] {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];

  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    pushCurrent();
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    // Woord past niet: hard splitsen per teken.
    let chunk = "";
    for (const ch of word) {
      if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    current = chunk;
  }
  pushCurrent();

  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    trimmed[maxLines - 1] = `${trimmed[maxLines - 1]}...`;
    return trimmed;
  }
  return lines.length ? lines : [""];
}