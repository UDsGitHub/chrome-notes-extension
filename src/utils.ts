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
