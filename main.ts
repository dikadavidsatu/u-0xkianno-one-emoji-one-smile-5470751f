import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// One emoji, chosen to greet a stranger the way an open hug does:
// warm at first glance, readable in any culture, friendly without
// flirtation, and not the first default smiley that comes to mind.
const ENTRY = "🤗";

function validate(text: string): void {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("entry must be a non-empty string");
  }
  // Gate: UTF-8 text of 1 to 8 characters, not only white space.
  const chars = [...text];
  if (chars.length < 1 || chars.length > 8) {
    throw new Error(`gate: expected 1-8 characters, got ${chars.length}`);
  }
  if (text.trim().length === 0) {
    throw new Error("gate: entry must not be only white space");
  }
  // This competition asks for exactly one emoji and nothing else.
  if (chars.length !== 1) {
    throw new Error(`expected exactly one character, got ${chars.length}`);
  }
  // Reject letters, digits and punctuation: the sole character must
  // be a pictographic symbol, not a word fragment or a text sign.
  if (!/\p{Extended_Pictographic}/u.test(text)) {
    throw new Error("gate: entry must be a single emoji");
  }
  // A variation selector or joiner would smuggle in a second glyph
  // presentation; the plain single code point needs neither.
  if (text.includes("\uFE0F") || text.includes("\u200D")) {
    throw new Error("gate: entry must not use selectors or joiners");
  }
}

validate(ENTRY);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.txt"), ENTRY, "utf8");
