import { NOTES_STORAGE_KEY, PENDING_NOTE_KEY } from "./constants.js";
import type { CreateNoteDto, Note, NoteContent, NotesList } from "./types.js";
import { getMaxNoteOrder } from "./utils.js";

export const getNotesST = async (): Promise<NotesList | null> => {
  const result = await chrome.storage.local.get(NOTES_STORAGE_KEY);
  const cachedNotes = result[NOTES_STORAGE_KEY];

  if (!cachedNotes) {
    return null;
  }

  return ensureNoteOrders(cachedNotes as NotesList);
};

async function ensureNoteOrders(notes: NotesList): Promise<NotesList> {
  const entries = Object.entries(notes);
  if (entries.length === 0) return notes;

  const needsMigration = entries.some(
    ([, note]) => typeof note.order !== "number",
  );
  if (!needsMigration) return notes;

  // Oldest → 0 … newest → highest, so higher order stays at the top.
  const byRecencyAsc = entries.toSorted((a, b) => {
    const dateA = new Date(a[1].updatedAt ?? a[1].createdAt).getTime();
    const dateB = new Date(b[1].updatedAt ?? b[1].createdAt).getTime();
    return dateA - dateB;
  });

  const migrated: NotesList = {};
  byRecencyAsc.forEach(([id, note], index) => {
    migrated[id] = { ...note, order: index };
  });

  await chrome.storage.local.set({
    [NOTES_STORAGE_KEY]: migrated,
  });

  return migrated;
}

export const addNoteST = async (note: CreateNoteDto) => {
  try {
    const notes = (await getNotesST()) ?? {};
    const id = `note-${crypto.randomUUID()}`;
    const order = getMaxNoteOrder(notes) + 1;
    const createData = {
      ...note,
      createdAt: new Date().toISOString(),
      order,
    };

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

/** `orderedIds` is top-to-bottom display order. */
export const reorderNotesST = async (orderedIds: string[]) => {
  const notes = (await getNotesST()) ?? {};
  const count = orderedIds.length;

  orderedIds.forEach((id, index) => {
    const existing = notes[id];
    if (!existing) return;
    notes[id] = {
      ...existing,
      order: count - 1 - index,
    };
  });

  await chrome.storage.local.set({
    [NOTES_STORAGE_KEY]: notes,
  });
};

export const importNotesST = async (incoming: Note[]) => {
  const notes = (await getNotesST()) ?? {};
  let imported = 0;
  let skipped = 0;
  let nextOrder = getMaxNoteOrder(notes);

  for (const note of incoming) {
    if (notes[note.id]) {
      skipped++;
      continue;
    }

    const { id, ...content } = note;
    nextOrder += 1;
    notes[id] = {
      ...content,
      order: typeof content.order === "number" ? content.order : nextOrder,
    };
    imported++;
  }

  if (imported > 0) {
    await chrome.storage.local.set({
      [NOTES_STORAGE_KEY]: notes,
    });
  }

  return { imported, skipped };
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
