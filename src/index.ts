import type types = require("./types");

const NOTES_EXTENSION_LOCAL_STORAGE_KEY = "notes-ext-ls";

const form = document.getElementById("notes-form");
const notesInput = document.getElementById(
  "notes-input",
) as HTMLTextAreaElement;
const notesList = document.querySelector(
  ".notes-list",
) as types.ElementWithHidden;
const notesEmpty = document.querySelector(
  ".notes-empty",
) as types.ElementWithHidden;
let activeNoteId: string | null = null;

const syncEmptyState = () => {
  if (notesList && notesEmpty) {
    const hasNotes = notesList.children.length > 0;
    notesEmpty.hidden = hasNotes;
    notesList.hidden = !hasNotes;
  }
};

const getCachedNotes = async (): Promise<types.NotesList | null> => {
  const result = await chrome.storage.local.get(
    NOTES_EXTENSION_LOCAL_STORAGE_KEY,
  );
  const cachedNotes = result[NOTES_EXTENSION_LOCAL_STORAGE_KEY];

  if (!cachedNotes) {
    return null;
  }

  return cachedNotes as types.NotesList;
};

const updateLocalStorage = async (note: types.Note) => {
  try {
    const notes = (await getCachedNotes()) ?? {};
    notes[note.id] = note.content;
    await chrome.storage.local.set({
      [NOTES_EXTENSION_LOCAL_STORAGE_KEY]: notes,
    });
  } catch (error) {
    console.warn("Failed to update local storage: ", error);
  }
};

const createNoteElement = (note: types.Note) => {
  const noteElement = document.createElement("li");

  noteElement.id = note.id;
  noteElement.className = "notes-list-item";
  noteElement.innerHTML = `
    <p class="notes-content"></p>
    <button class="notes-actions-button copy-btn">
        <svg
            class="icon"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
            stroke="currentColor"
            stroke-linejoin="round"
            stroke-width="1"
            d="M9 8v3a1 1 0 0 1-1 1H5m11 4h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v1m4 3v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.13a1 1 0 0 1 .24-.65L7.7 8.35A1 1 0 0 1 8.46 8H13a1 1 0 0 1 1 1Z"
            />
        </svg>
    </button>
    <button class="notes-actions-button delete-btn">
        <svg
            class="icon"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M6 18 17.94 6M18 18 6.06 6"
            />
        </svg>
    </button>
  `;

  const notesContent = noteElement.querySelector(".notes-content");
  if (notesContent) {
    notesContent.textContent = note.content;
    notesList.appendChild(noteElement);
    syncEmptyState();
  }
};

const updateNoteElement = (note: types.Note) => {
  const noteElement = document.getElementById(note.id);
  const notesContent = noteElement?.querySelector(".notes-content");
  if (notesContent) {
    notesContent.textContent = note.content;
  }
};

const addNote = (value: string) => {
  const id = activeNoteId ?? `note-${crypto.randomUUID()}`;
  const note = {
    id,
    content: value,
  };

  updateLocalStorage(note);
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

const deleteNote = async () => {
  try {
    if (!activeNoteId) {
      throw new Error("Missing active note id");
    }

    const notes = await getCachedNotes()
    if (!notes) {
      throw new Error("Local storage does not contain notes record");
    }


    delete notes[activeNoteId];
    await chrome.storage.local.set({
      [NOTES_EXTENSION_LOCAL_STORAGE_KEY]: notes,
    });

    document.getElementById(activeNoteId)?.remove();
    activeNoteId = null;
    syncEmptyState();
  } catch (error) {
    console.warn("Failed to delete note: ", error);
  }
};

const cleanUp = () => {
  if (notesInput) {
    notesInput.value = "";
  }
  if (!!activeNoteId) {
    const activeNote = document.getElementById(activeNoteId);
    activeNote?.classList.remove("editing");
    activeNoteId = null;
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

notesList.addEventListener("click", (e) => {
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
    activeNoteId = listItem.id;
    deleteNote();

    return;
  }

  const listItem = e.target.closest(".notes-list-item");
  if (listItem) {
    if (activeNoteId) {
      const activeNote = document.getElementById(activeNoteId);
      activeNote?.classList.remove("editing");
    }

    const noteId = listItem.id;
    const noteContent = listItem.querySelector(".notes-content")?.textContent;
    if (!noteContent) return;
    listItem.classList.add("editing");
    activeNoteId = noteId;
    notesInput.value = noteContent;

    return;
  }
});

(async function loadNotes() {
  try {
    const notes = await getCachedNotes()

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
