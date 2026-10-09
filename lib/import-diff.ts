import type { ExtractedItem, ItemDoc } from "@/types/models";

/** The slice of an existing item the matcher needs. */
export type ExistingItem = Pick<ItemDoc, "name" | "section" | "qtyNeeded"> & { id: string; qtyHave?: number };

export type DiffEntry =
  | { kind: "unchanged"; existing: ExistingItem; incoming: ExtractedItem }
  | { kind: "changed"; existing: ExistingItem; incoming: ExtractedItem }
  | { kind: "added"; incoming: ExtractedItem }
  | { kind: "removed"; existing: ExistingItem };

export interface ImportDiff {
  unchanged: Extract<DiffEntry, { kind: "unchanged" }>[];
  changed: Extract<DiffEntry, { kind: "changed" }>[];
  added: Extract<DiffEntry, { kind: "added" }>[];
  removed: Extract<DiffEntry, { kind: "removed" }>[];
}

/** Minimum bigram similarity for the fuzzy pass. Below this, rows are treated as different items. */
const FUZZY_THRESHOLD = 0.85;

/**
 * Lowercases, drops parentheticals ("(Black)"), and collapses punctuation and
 * whitespace so cosmetic edits between list versions still match.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const padded = ` ${text} `;
  for (let i = 0; i < padded.length - 1; i++) {
    const gram = padded.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** Sørensen–Dice coefficient over character bigrams, 0..1. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let overlap = 0;
  for (const [gram, countA] of gramsA) {
    overlap += Math.min(countA, gramsB.get(gram) ?? 0);
  }
  return (2 * overlap) / (a.length + 1 + (b.length + 1));
}

/**
 * Matches rows from a revised list to the items already on the checklist.
 *
 * Passes, each consuming matches so one item is never claimed twice:
 *   1. Same section + same normalized name
 *   2. Same normalized name in a different section (the section guess moved)
 *   3. Fuzzy name match within the same section, best score first
 * Within a pass, repeated names pair up in list order, so a name that appears
 * on two lines in both versions maps line-for-line instead of collapsing.
 */
export function diffItems(existing: ExistingItem[], incoming: ExtractedItem[]): ImportDiff {
  const matchedExisting = new Map<number, number>(); // existing index -> incoming index
  const matchedIncoming = new Set<number>();

  const existingNames = existing.map((item) => normalizeName(item.name));
  const incomingNames = incoming.map((item) => normalizeName(item.name));

  function pair(existingIndex: number, incomingIndex: number) {
    matchedExisting.set(existingIndex, incomingIndex);
    matchedIncoming.add(incomingIndex);
  }

  function exactPass(sameSection: boolean) {
    incoming.forEach((row, incomingIndex) => {
      if (matchedIncoming.has(incomingIndex)) return;
      const existingIndex = existing.findIndex(
        (item, i) =>
          !matchedExisting.has(i) &&
          existingNames[i] === incomingNames[incomingIndex] &&
          (!sameSection || item.section === row.section),
      );
      if (existingIndex !== -1) pair(existingIndex, incomingIndex);
    });
  }

  exactPass(true);
  exactPass(false);

  const candidates: { existingIndex: number; incomingIndex: number; score: number }[] = [];
  existing.forEach((item, existingIndex) => {
    if (matchedExisting.has(existingIndex)) return;
    incoming.forEach((row, incomingIndex) => {
      if (matchedIncoming.has(incomingIndex) || row.section !== item.section) return;
      const score = similarity(existingNames[existingIndex], incomingNames[incomingIndex]);
      if (score >= FUZZY_THRESHOLD) candidates.push({ existingIndex, incomingIndex, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);
  for (const { existingIndex, incomingIndex } of candidates) {
    if (matchedExisting.has(existingIndex) || matchedIncoming.has(incomingIndex)) continue;
    pair(existingIndex, incomingIndex);
  }

  const diff: ImportDiff = { unchanged: [], changed: [], added: [], removed: [] };

  incoming.forEach((row, incomingIndex) => {
    if (!matchedIncoming.has(incomingIndex)) diff.added.push({ kind: "added", incoming: row });
  });

  existing.forEach((item, existingIndex) => {
    const incomingIndex = matchedExisting.get(existingIndex);
    if (incomingIndex === undefined) {
      diff.removed.push({ kind: "removed", existing: item });
      return;
    }
    const row = incoming[incomingIndex];
    if (row.qtyNeeded === item.qtyNeeded) {
      diff.unchanged.push({ kind: "unchanged", existing: item, incoming: row });
    } else {
      diff.changed.push({ kind: "changed", existing: item, incoming: row });
    }
  });

  return diff;
}
