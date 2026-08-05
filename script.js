const NOTES_EXTENSION_LOCAL_STORAGE_KEY = "notes-ext-ls";

const form = document.getElementById("notes-form");
const notesInput = document.getElementById("notes-input");
const notesList = document.querySelector(".notes-list");
const notesEmpty = document.querySelector(".notes-empty");
let activeNoteId = null;

const syncEmptyState = () => {
  const hasNotes = notesList.children.length > 0;
  notesEmpty.hidden = hasNotes;
  notesList.hidden = !hasNotes;
};

const updateLocalStorage = (note) => {
  try {
    const cachedNotes = localStorage.getItem(NOTES_EXTENSION_LOCAL_STORAGE_KEY);
    if (!cachedNotes) {
      const notes = JSON.stringify({
        [note.id]: note.content,
      });
      localStorage.setItem(NOTES_EXTENSION_LOCAL_STORAGE_KEY, notes);
    } else {
      const notesList = JSON.parse(cachedNotes);
      notesList[note.id] = note.content;
      localStorage.setItem(
        NOTES_EXTENSION_LOCAL_STORAGE_KEY,
        JSON.stringify(notesList),
      );
    }
  } catch (error) {
    console.warn("Failed to update local storage: ", error);
  }
};

const createNoteElement = (note) => {
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
  noteElement.querySelector(".notes-content").textContent = note.content;
  notesList.appendChild(noteElement);
  syncEmptyState();
};

const updateNoteElement = (note) => {
  const noteElement = document.getElementById(note.id);
  noteElement.querySelector(".notes-content").textContent = note.content;
};

const addNote = (value) => {
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

const copyNote = (value) => {
  navigator.clipboard.writeText(value).catch((err) => {
    console.error("Failed to copy text: ", err);
  });
};

const deleteNote = () => {
  try {
    const cachedNotes = localStorage.getItem(NOTES_EXTENSION_LOCAL_STORAGE_KEY);
    if (!cachedNotes) {
      throw new Error("Local storage does not contain notes record");
    }

    const notesList = JSON.parse(cachedNotes);
    delete notesList[activeNoteId];
    localStorage.setItem(
      NOTES_EXTENSION_LOCAL_STORAGE_KEY,
      JSON.stringify(notesList),
    );
  } catch (error) {
    console.warn("Failed to delete note: ", error);
  }

  document.getElementById(activeNoteId).remove();
  activeNoteId = null;
  syncEmptyState();
};

const cleanUp = () => {
  notesInput.value = "";
  if (!!activeNoteId) {
    const activeNote = document.getElementById(activeNoteId);
    activeNote?.classList.remove("editing");
    activeNoteId = null;
  }
};

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const noteInputValue = notesInput.value.trim();
  if (noteInputValue !== "") {
    addNote(noteInputValue);
    cleanUp();
  }
});

notesList.addEventListener("click", (e) => {
  const copyBtn = e.target.closest(".copy-btn");
  if (copyBtn) {
    const noteContent = copyBtn.previousElementSibling.textContent;
    copyNote(noteContent);

    return;
  }

  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const listItem = deleteBtn.closest("li");
    activeNoteId = listItem.id;
    deleteNote();

    return;
  }

  const listItem = e.target.closest(".notes-list-item");
  if (listItem) {
    if (activeNoteId) {
      document.getElementById(activeNoteId).classList.remove("editing");
    }

    const noteId = listItem.id;
    const noteContent = listItem.querySelector(".notes-content").textContent;
    listItem.classList.add("editing");
    activeNoteId = noteId;
    notesInput.value = noteContent;

    return;
  }
});

(function loadNotes() {
  try {
    const cachedNotes = localStorage.getItem(NOTES_EXTENSION_LOCAL_STORAGE_KEY);

    if (cachedNotes) {
      const notes = JSON.parse(cachedNotes);
      Object.entries(notes).forEach((entry) => {
        const note = {
          id: entry[0],
          content: entry[1],
        };

        console.log(note)
        createNoteElement(note);
      });
    }
  } catch (error) {
    console.warn("Failed to load notes from local storage: ", error);
  } finally {
    syncEmptyState();
  }
})();
