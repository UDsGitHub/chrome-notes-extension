import { NoteActions } from "./actions.js";
import { syncPendingNote } from "./storage.js";

const form = document.getElementById("notes-form");
const notesInput = document.getElementById(
  "notes-input",
) as HTMLTextAreaElement;
const notesList = document.querySelector(".notes-list") as HTMLElement;
const notesTemplate = document.getElementById(
  "notes-list-item__template",
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

const indicatorTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

const showIndicator = (
  listItem: Element,
  textContent: string,
  duration: number = 1500,
) => {
  const indicator = listItem.querySelector(".notes-list-item__indicator");
  if (!(indicator instanceof HTMLElement)) return;

  const existingTimer = indicatorTimers.get(indicator);
  if (existingTimer) clearTimeout(existingTimer);

  indicator.textContent = textContent;
  indicator.classList.remove("visible");
  void indicator.offsetWidth;
  indicator.classList.add("visible");

  const timer = setTimeout(() => {
    indicator.classList.remove("visible");
    indicatorTimers.delete(indicator);
  }, duration);
  indicatorTimers.set(indicator, timer);
};

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const noteInputValue = notesInput.value.trim();
  if (noteInputValue !== "") {
    await actions.addNote(noteInputValue, activeNoteId);
    if (activeNoteId) {
      const listItem = document.getElementById(activeNoteId);
      if (listItem) {
        showIndicator(listItem, "Updated");
      }
    }
    cleanUp();
  }
});

notesList?.addEventListener("click", async (e) => {
  if (!(e.target instanceof Element)) return;

  // EDIT NOTE
  const editBtn = e.target.closest(".edit-btn");
  if (editBtn) {
    const listItem = e.target.closest(".notes-list-item");
    if (listItem) {
      if (activeNoteId) {
        const activeNote = document.getElementById(activeNoteId);
        activeNote?.classList.remove("editing");
      }

      if (cancelEditBtn) {
        cancelEditBtn.hidden = false;
      }

      const noteContent = listItem.querySelector(
        ".notes-list-item__content",
      )?.textContent;
      if (!noteContent) return;
      listItem.classList.add("editing");
      activeNoteId = listItem.id;
      notesInput.value = noteContent;
      notesInput.focus();

      return;
    }
  }

  // DELETE NOTE
  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const listItem = deleteBtn.closest("li");
    if (!listItem) return;
    await actions.deleteNote(listItem.id);

    return;
  }

  // COPY NOTE
  const listItem = e.target.closest(".notes-list-item");
  if (listItem) {
    const noteContent = listItem.querySelector(
      ".notes-list-item__content",
    )?.textContent;
    if (noteContent) actions.copyNote(noteContent);
    showIndicator(listItem, "Copied");
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
