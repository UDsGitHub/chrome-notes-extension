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

/**
  * Notes are returned in ascending order because of node appending  
  * Reverse array if descending order is needed
*/
export function getSortedNotes(notes: NotesList) {
  return Object.entries(notes).toSorted((a, b) => {
    const dateA = new Date(a[1].updatedAt ?? a[1].createdAt);
    const dateB = new Date(b[1].updatedAt ?? b[1].createdAt);
    return dateA.getTime() - dateB.getTime();
  });
}
