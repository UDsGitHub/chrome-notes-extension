import { NOTE_TAG_MAX_LENGTH, NOTE_TAGS_MAX_COUNT } from "./constants.js";
import type { NotesList } from "./types.js";

export function truncateText(text: string, maxLength: number) {
  const truncatedText = text.slice(0, maxLength);
  if (truncatedText.length < maxLength) return truncatedText;

  const lastSpace = truncatedText.lastIndexOf(" ");
  return lastSpace > 0
    ? `${truncatedText.slice(0, lastSpace)}...`
    : truncatedText;
}

/** Trim, dedupe (case-insensitive), and cap tag length/count. */
export function normalizeTags(input: unknown): string[] {
  const raw: unknown[] = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[,;]/)
      : [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().replace(/\s+/g, " ").slice(0, NOTE_TAG_MAX_LENGTH);
    if (!tag) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);

    if (tags.length >= NOTE_TAGS_MAX_COUNT) break;
  }

  return tags;
}

export function parseTagsInput(text: string): string[] {
  return normalizeTags(text);
}

export function formatTagsInput(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

export function serializeTagsCsv(tags: string[] | undefined): string {
  return (tags ?? []).join(";");
}

export function noteMatchesQuery(
  note: { title: string; content: string; tags?: string[] },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (note.title.toLowerCase().includes(q)) return true;
  if (note.content.toLowerCase().includes(q)) return true;
  return (note.tags ?? []).some((tag) => tag.toLowerCase().includes(q));
}

export function noteHasTag(
  note: { tags?: string[] },
  tag: string | null | undefined,
): boolean {
  const active = tag?.trim();
  if (!active) return true;
  const key = active.toLowerCase();
  return (note.tags ?? []).some((entry) => entry.toLowerCase() === key);
}

/** Tag chip scopes the set; search then narrows within it. */
export function noteMatchesFilters(
  note: { title: string; content: string; tags?: string[] },
  options: { query?: string; tag?: string | null } = {},
): boolean {
  if (!noteHasTag(note, options.tag)) return false;
  return noteMatchesQuery(note, options.query ?? "");
}

/** Unique tags across notes, sorted case-insensitively. */
export function collectUniqueTags(notes: NotesList): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const note of Object.values(notes)) {
    for (const tag of note.tags ?? []) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
  }

  return tags.toSorted((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function noteTimestamp(note: NotesList[string]) {
  return new Date(note.updatedAt ?? note.createdAt).getTime();
}

function isPinned(note: NotesList[string]) {
  return Boolean(note.pinned);
}

/**
 * Returns notes in display order: top of the list first.
 * Pinned notes come first, then manual `order` (higher = nearer top).
 */
export function getSortedNotes(notes: NotesList) {
  return Object.entries(notes).toSorted((a, b) => {
    const pinnedA = isPinned(a[1]);
    const pinnedB = isPinned(b[1]);
    if (pinnedA !== pinnedB) {
      return pinnedA ? -1 : 1;
    }

    const orderA = a[1].order;
    const orderB = b[1].order;
    const hasOrderA = typeof orderA === "number";
    const hasOrderB = typeof orderB === "number";

    if (hasOrderA && hasOrderB && orderA !== orderB) {
      return orderB! - orderA!;
    }
    if (hasOrderA !== hasOrderB) {
      return hasOrderA ? -1 : 1;
    }

    return noteTimestamp(b[1]) - noteTimestamp(a[1]);
  });
}

export function getMaxNoteOrder(
  notes: NotesList,
  pinned: boolean | undefined = undefined,
) {
  let max = -1;
  for (const note of Object.values(notes)) {
    if (pinned !== undefined && isPinned(note) !== pinned) continue;
    if (typeof note.order === "number" && note.order > max) {
      max = note.order;
    }
  }
  return max;
}
