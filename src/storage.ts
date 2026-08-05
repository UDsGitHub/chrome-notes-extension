import { NOTES_STORAGE_KEY, PENDING_NOTE_KEY } from "./constants.js";
import type { Note, NotesList } from "./types.js";

export const getNotesST = async (): Promise<NotesList | null> => {
  const result = await chrome.storage.local.get(NOTES_STORAGE_KEY);
  const cachedNotes = result[NOTES_STORAGE_KEY];

  if (!cachedNotes) {
    return null;
  }

  return cachedNotes as NotesList;
};

export const saveNoteST = async (note: Note) => {
  try {
    const notes = (await getNotesST()) ?? {};
    notes[note.id] = note.content;
    await chrome.storage.local.set({
      [NOTES_STORAGE_KEY]: notes,
    });
  } catch (error) {
    console.error("Failed to update local storage: ", error);
  }
};

export const deleteNoteST = async (noteId: string) => {
  const notes = await getNotesST();
  if (!notes) {
    throw new Error("Local storage does not contain notes record");
  }

  delete notes[noteId];
  await chrome.storage.local.set({
    [NOTES_STORAGE_KEY]: notes,
  });
};

export const syncPendingNote = async (
  addNote: (value: string) => Promise<void>,
) => {
  const pendingNote = await chrome.storage.session.get(PENDING_NOTE_KEY);
  const pendingNoteContent = pendingNote[PENDING_NOTE_KEY];
  if (pendingNoteContent && pendingNoteContent.trim() !== "") {
    await addNote(pendingNoteContent.trim());
    await chrome.storage.session.remove(PENDING_NOTE_KEY);
  }
};
