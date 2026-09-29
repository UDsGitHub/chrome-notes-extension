import { NOTES_STORAGE_KEY, PENDING_NOTE_KEY } from "./constants.js";
import type { CreateNoteDto, Note, NoteContent, NotesList } from "./types.js";

export const getNotesST = async (): Promise<NotesList | null> => {
  const result = await chrome.storage.local.get(NOTES_STORAGE_KEY);
  const cachedNotes = result[NOTES_STORAGE_KEY];

  if (!cachedNotes) {
    return null;
  }

  return cachedNotes as NotesList;
};

export const addNoteST = async (note: CreateNoteDto) => {
  try {
    const notes = (await getNotesST()) ?? {};
    const id = `note-${crypto.randomUUID()}`;
    const createData = { ...note, createdAt: new Date().toISOString() };

    notes[id] = createData;
    await chrome.storage.local.set({
      [NOTES_STORAGE_KEY]: notes,
    });

    return { id, ...createData } as Note;
  } catch (error) {
    console.error("Failed to update local storage: ", error);
  }
};

export const updateNoteST = async (id: string, note: Partial<NoteContent>) => {
  try {
    const notes = (await getNotesST()) ?? {};
    const existing = notes[id];
    if (!existing || typeof existing !== "object") {
      throw new Error(`Note not found: ${id}`);
    }

    const updateData = {
      ...existing,
      ...note,
      updatedAt: new Date().toISOString(),
    };
    notes[id] = updateData;
    await chrome.storage.local.set({
      [NOTES_STORAGE_KEY]: notes,
    });

    return { id, ...updateData };
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
  addNote: (value: string) => Promise<Note | undefined>,
) => {
  const pendingNote = await chrome.storage.session.get(PENDING_NOTE_KEY);
  const pendingNoteContent = pendingNote[PENDING_NOTE_KEY];
  if (pendingNoteContent && pendingNoteContent.trim() !== "") {
    const createdNote = await addNote(pendingNoteContent.trim());
    await chrome.storage.session.remove(PENDING_NOTE_KEY);

    return createdNote;
  }
};
