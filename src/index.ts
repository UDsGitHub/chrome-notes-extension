import { NoteActions } from "./actions.js";
import { syncPendingNote } from "./storage.js";

const form = document.getElementById("notes-form");
const notesInput = document.getElementById(
  "notes-input",
) as HTMLTextAreaElement;
const notesList = document.querySelector(".notes-list") as HTMLElement;
const notesTemplate = document.getElementById(
  "notes-list-item-template",
) as HTMLTemplateElement;
const notesEmpty = document.querySelector(".notes-empty") as HTMLElement;
const cancelEditBtn = document.querySelector<HTMLElement>(".cancel-edit-btn");

let activeNoteId: string | null = null;
const actions = new NoteActions(notesList, notesEmpty, notesTemplate);

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
    cancelEditBtn.hidden = true;
  }
};

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const noteInputValue = notesInput.value.trim();
  if (noteInputValue !== "") {
    await actions.addNote(noteInputValue, activeNoteId);
    cleanUp();
  }
});

notesList?.addEventListener("click", async (e) => {
  if (!(e.target instanceof Element)) return;

  const copyBtn = e.target.closest(".copy-btn");
  if (copyBtn) {
    const noteContent = copyBtn.nextElementSibling?.textContent;
    console.log('content to be copied: ', noteContent)
    if (noteContent) actions.copyNote(noteContent);

    return;
  }

  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const listItem = deleteBtn.closest("li");
    if (!listItem) return;
    await actions.deleteNote(listItem.id);

    return;
  }

  const listItem = e.target.closest(".notes-list-item");
  if (listItem) {
    if (activeNoteId) {
      const activeNote = document.getElementById(activeNoteId);
      activeNote?.classList.remove("editing");
    }

    if (cancelEditBtn) {
      cancelEditBtn.hidden = false;
    }

    const noteContent = listItem.querySelector(".notes-content")?.textContent;
    if (!noteContent) return;
    listItem.classList.add("editing");
    activeNoteId = listItem.id;
    notesInput.value = noteContent;
    notesInput.focus();

    return;
  }
});

cancelEditBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  cleanUp();
});

actions.loadNotes(activeNoteId);
chrome.storage.session.onChanged.addListener(() =>
  syncPendingNote((value) => actions.addNote(value, null)),
);
