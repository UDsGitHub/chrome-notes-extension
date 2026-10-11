import type { NotesList } from "./types.js";

export function truncateText(text: string, maxLength: number) {
  const truncatedText = text.slice(0, maxLength);
  if (truncatedText.length < maxLength) return truncatedText;

  const lastSpace = truncatedText.lastIndexOf(" ");
  return lastSpace > 0
    ? `${truncatedText.slice(0, lastSpace)}...`
    : truncatedText;
}

export const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function noteTimestamp(note: NotesList[string]) {
  return new Date(note.updatedAt ?? note.createdAt).getTime();
}

/**
 * Returns notes in display order: top of the list first.
 * Prefers manual `order` (higher = nearer top). Falls back to recency.
 */
export function getSortedNotes(notes: NotesList) {
  return Object.entries(notes).toSorted((a, b) => {
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

    // Newest first when no manual order is present yet.
    return noteTimestamp(b[1]) - noteTimestamp(a[1]);
  });
}

export function getMaxNoteOrder(notes: NotesList) {
  let max = -1;
  for (const note of Object.values(notes)) {
    if (typeof note.order === "number" && note.order > max) {
      max = note.order;
    }
  }
  return max;
}
