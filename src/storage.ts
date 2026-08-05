import { NOTES_EXTENSION_LOCAL_STORAGE_KEY } from "./constants";
import type { Note, NotesList } from "./types";

export const getNotes = async (): Promise<NotesList | null> => {
  const result = await chrome.storage.local.get(
    NOTES_EXTENSION_LOCAL_STORAGE_KEY,
  );
  const cachedNotes = result[NOTES_EXTENSION_LOCAL_STORAGE_KEY];

  if (!cachedNotes) {
    return null;
  }

  return cachedNotes as NotesList;
};

export const saveNote = async (note: Note) => {
  try {
    const notes = (await getNotes()) ?? {};
    notes[note.id] = note.content;
    await chrome.storage.local.set({
      [NOTES_EXTENSION_LOCAL_STORAGE_KEY]: notes,
    });
  } catch (error) {
    console.warn("Failed to update local storage: ", error);
  }
};
