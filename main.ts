// One Emoji, One Smile — entry program.
//
// The task: send exactly one emoji, the one most likely to make a
// stranger smile. A judge model compares entries two at a time and picks
// the warmer one, so this program does not hard-code a guess and stop
// there: it scores a shortlist of candidates against the judge's own
// brief, in the order the brief weighs its criteria, and writes the
// winner — one emoji and nothing else — to entry.txt.
//
// The judge's criteria, most important first:
//   1. a single emoji a stranger reads as warm and friendly;
//   2. warmth at first glance, kind/friendly/gently funny, no context;
//   3. universality — read the same way at any age or background;
//   4. chosen rather than default — picked for the moment, not the
//      first smiley that comes to mind, while staying instantly readable;
//   5. right for a stranger — no intimacy, sarcasm or flirtation.
//
// The gate the sealed scorer applies to /output/entry.txt:
// UTF-8 text of 1 to 8 characters, not only white space. Only a valid
// entry goes before the judge, so the program validates its own output
// against that gate — and re-reads the file it just wrote — before it
// exits. It writes the emoji with no trailing newline: the file holds
// exactly one emoji and nothing else.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// The shortlist, scored 0-5 on each of the judge's five criteria.
// Weights fall in the brief's own order: the first criterion matters
// most, the last least. Scores are my own judgement, written down so
// the pick can be argued with instead of taken on trust.
// ---------------------------------------------------------------------------

const CRITERION_WEIGHTS = [4, 3, 2, 2, 1] as const;

interface Candidate {
  emoji: string;
  // Scores in criterion order: [warmAndFriendly, warmthAtFirstGlance,
  // universality, chosenNotDefault, rightForStranger].
  scores: [number, number, number, number, number];
  why: string;
}

const CANDIDATES: Candidate[] = [
  {
    emoji: "🤗",
    scores: [5, 5, 5, 4, 4],
    why: "A smiling face with open arms: the picture of an offered hug. "
      + "Warm at first glance, readable in any culture, clearly a deliberate "
      + "pick rather than the default smiley, and friendly without romance.",
  },
  {
    emoji: "😊",
    scores: [5, 5, 5, 2, 5],
    why: "The warmest plain smile, and perfectly safe from a stranger — "
      + "but it is the first smiley that comes to mind, so it loses on "
      + "being chosen rather than default.",
  },
  {
    emoji: "🥰",
    scores: [5, 5, 4, 4, 2],
    why: "Undeniably warm, but the hearts read as affection, and affection "
      + "from a stranger can land as flirtation. Fails the stranger test.",
  },
  {
    emoji: "🫶",
    scores: [4, 4, 4, 5, 4],
    why: "Heart hands are a deliberate, modern gesture of warmth with no "
      + "romance attached — but a gesture reads a beat slower than a face, "
      + "and warmth at first glance is what the judge weighs second.",
  },
  {
    emoji: "😄",
    scores: [4, 5, 5, 2, 5],
    why: "A big open grin, universal and safe, yet as much a default pick "
      + "as the plain smile, and a grin is excitement as much as warmth.",
  },
  {
    emoji: "🌻",
    scores: [3, 4, 5, 5, 5],
    why: "A sunflower is cheerful, universal and unmistakably chosen — but "
      + "it is a flower, not a greeting, so it scores lower on plain warmth "
      + "than any smiling face.",
  },
  {
    emoji: "💛",
    scores: [4, 3, 5, 3, 4],
    why: "A yellow heart is warm and safe, but a coloured shape says less "
      + "at a glance than a face does, and hearts are everyone's default.",
  },
  {
    emoji: "☀️",
    scores: [3, 3, 5, 4, 5],
    why: "Sunshine is friendly and universal, but it is weather, not a "
      + "greeting, and it leans on a variation selector to render as emoji.",
  },
];

// ---------------------------------------------------------------------------
// Picking the winner.
// ---------------------------------------------------------------------------

/** Weighted total of a candidate's five criterion scores. */
function scoreCandidate(candidate: Candidate): number {
  let total = 0;
  for (let i = 0; i < candidate.scores.length; i++) {
    total += candidate.scores[i] * CRITERION_WEIGHTS[i];
  }
  return total;
}

/**
 * Return the highest-scoring candidate. Ties break the way the
 * competition breaks them: fewer bytes first, then the earlier entry
 * in the list, so the result is deterministic and never left to chance.
 */
function pickWinner(candidates: readonly Candidate[]): Candidate {
  let best = candidates[0];
  let bestScore = scoreCandidate(best);
  for (const candidate of candidates.slice(1)) {
    const score = scoreCandidate(candidate);
    const bestBytes = Buffer.byteLength(best.emoji, "utf8");
    const bytes = Buffer.byteLength(candidate.emoji, "utf8");
    if (score > bestScore || (score === bestScore && bytes < bestBytes)) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Gate validation: the entry must be exactly one emoji, 1-8 characters,
// not only white space. Anything else is refused before a file is written.
// ---------------------------------------------------------------------------

function validateEntry(text: string): void {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("gate: entry must be a non-empty string");
  }
  // Count characters as code points, the way the gate counts them.
  const chars = [...text];
  if (chars.length < 1 || chars.length > 8) {
    throw new Error(`gate: expected 1-8 characters, got ${chars.length}`);
  }
  if (text.trim().length === 0) {
    throw new Error("gate: entry must not be only white space");
  }
  // Exactly one emoji and nothing else: one character, pictographic,
  // with no variation selector or zero-width joiner smuggling in a
  // second glyph or a text presentation.
  if (chars.length !== 1) {
    throw new Error(`gate: expected exactly one emoji, got ${chars.length} characters`);
  }
  if (!/\p{Extended_Pictographic}/u.test(text)) {
    throw new Error("gate: entry must be a single emoji, not a letter or sign");
  }
  // A variation selector (U+FE0F) or zero-width joiner (U+200D) would
  // smuggle in a second glyph presentation; the plain single code point
  // needs neither, so both are refused outright.
  if (text.includes("\uFE0F") || text.includes("\u200D")) {
    throw new Error("gate: entry must not use a variation selector or joiner");
  }
}

// ---------------------------------------------------------------------------
// Run: pick, validate, write, then read the file back and validate the
// bytes that actually landed on disk, so a bad write can never pass
// silently.
// ---------------------------------------------------------------------------

function main(): void {
  const winner = pickWinner(CANDIDATES);
  validateEntry(winner.emoji);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  // No trailing newline: the file holds exactly one emoji, nothing else.
  writeFileSync(outPath, winner.emoji, "utf8");

  const written = readFileSync(outPath, "utf8");
  if (written !== winner.emoji) {
    throw new Error(`gate: wrote ${JSON.stringify(written)}, expected ${JSON.stringify(winner.emoji)}`);
  }
  validateEntry(written);
}

main();
