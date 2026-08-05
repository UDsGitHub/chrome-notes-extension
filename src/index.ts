import { NOTES_EXTENSION_LOCAL_STORAGE_KEY } from "./constants";
import { getNotes, saveNote } from "./storage";
import type { Note, NotesList } from "./types";

const form = document.getElementById("notes-form");
const notesInput = document.getElementById(
  "notes-input",
) as HTMLTextAreaElement;
const notesList = document.querySelector<HTMLElement>(".notes-list");
const notesListItemTemplate = document.getElementById(
  "notes-list-item-template",
) as HTMLTemplateElement;
const notesEmpty = document.querySelector<HTMLElement>(".notes-empty");
const cancelEditBtn = document.querySelector<HTMLElement>(".cancel-edit-btn");

let activeNoteId: string | null = null;

const syncEmptyState = () => {
  if (notesList && notesEmpty) {
    const hasNotes = notesList.children.length > 0;
    notesEmpty.hidden = hasNotes;
    notesList.hidden = !hasNotes;
  }
};

const createNoteElement = (note: Note) => {
  const noteElement = notesListItemTemplate.content.cloneNode(
    true,
  ) as DocumentFragment;
  const notesContent = noteElement.querySelector(".notes-content");
  if (notesContent) {
    notesContent.textContent = note.content;
    notesList?.appendChild(noteElement);
    syncEmptyState();
  }
};

const updateNoteElement = (note: Note) => {
  const noteElement = document.getElementById(note.id);
  const notesContent = noteElement?.querySelector(".notes-content");
  if (notesContent) {
    notesContent.textContent = note.content;
  }
};

const addNote = async (value: string) => {
  const id = activeNoteId ?? `note-${crypto.randomUUID()}`;
  const note = {
    id,
    content: value,
  };

  await saveNote(note);
  if (activeNoteId) {
    updateNoteElement(note);
  } else {
    createNoteElement(note);
  }
};

const copyNote = (value: string) => {
  navigator.clipboard.writeText(value).catch((err) => {
    console.error("Failed to copy text: ", err);
  });
};

const deleteNote = async (noteId: string) => {
  try {
    const notes = await getNotes();
    if (!notes) {
      throw new Error("Local storage does not contain notes record");
    }

    delete notes[noteId];
    await chrome.storage.local.set({
      [NOTES_EXTENSION_LOCAL_STORAGE_KEY]: notes,
    });

    document.getElementById(noteId)?.remove();
    syncEmptyState();
  } catch (error) {
    console.warn("Failed to delete note: ", error);
  }
};

const cleanUp = () => {
  if (notesInput) {
    notesInput.value = "";
  }
  if (activeNoteId) {
    const activeNote = document.getElementById(activeNoteId);
    activeNote?.classList.remove("editing");
    activeNoteId = null;
  }
  if (cancelEditBtn) {
    cancelEditBtn.setAttribute("hidden", "true");
  }
};

form?.addEventListener("submit", (e) => {
  e.preventDefault();

  const noteInputValue = notesInput.value.trim();
  if (noteInputValue !== "") {
    addNote(noteInputValue);
    cleanUp();
  }
});

notesList?.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;

  const copyBtn = e.target.closest(".copy-btn");
  if (copyBtn) {
    const noteContent = copyBtn.previousElementSibling?.textContent;
    if (noteContent) copyNote(noteContent);

    return;
  }

  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const listItem = deleteBtn.closest("li");
    if (!listItem) return;
    deleteNote(listItem.id);

    return;
  }

  const listItem = e.target.closest(".notes-list-item");
  if (listItem) {
    if (activeNoteId) {
      const activeNote = document.getElementById(activeNoteId);
      activeNote?.classList.remove("editing");
    }

    if (cancelEditBtn) {
      cancelEditBtn.removeAttribute("hidden");
    }

    const noteId = listItem.id;
    const noteContent = listItem.querySelector(".notes-content")?.textContent;
    if (!noteContent) return;
    listItem.classList.add("editing");
    activeNoteId = noteId;
    notesInput.value = noteContent;
    notesInput.focus();

    return;
  }
});

cancelEditBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  cleanUp();
});

(async function loadNotes() {
  try {
    const notes = await getNotes();

    if (notes) {
      Object.entries(notes).forEach((entry) => {
        const note = {
          id: entry[0],
          content: entry[1],
        };

        createNoteElement(note);
      });
    }
  } catch (error) {
    console.warn("Failed to load notes from local storage: ", error);
  } finally {
    syncEmptyState();
  }
})();
