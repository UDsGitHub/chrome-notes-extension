import { NoteActions } from "./actions.js";
import { NOTE_BODY_MAX_DISPLAY_LENGTH } from "./constants.js";
import { syncPendingNote } from "./storage.js";
import { truncateText } from "./utils.js";

const form = document.getElementById("notes-form") as HTMLFormElement;
const notesTitleInput = document.getElementById(
  "notes-title-input",
) as HTMLInputElement;
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
  if (notesTitleInput) {
    notesTitleInput.value = "";
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

form?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    form?.requestSubmit();
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const noteTitleValue = notesTitleInput.value.trim();
  const noteInputValue = notesInput.value.trim();
  if (noteTitleValue && noteInputValue) {
    await actions.addNote(noteTitleValue, noteInputValue, activeNoteId);
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

  // TOGGLE TRUNCATION
  const truncationToggle = e.target.closest(".notes-list-item__truncateToggle");
  if (truncationToggle) {
    const listItem = e.target.closest(".notes-list-item");
    if (listItem) {
      const notesContent = listItem.querySelector(".notes-list-item__content");
      if (notesContent) {
        if (notesContent.getAttribute("aria-expanded") === "true") {
          notesContent.setAttribute("aria-expanded", "false");
          notesContent.textContent = truncateText(
            notesContent.getAttribute("data-full-text") ?? "",
            NOTE_BODY_MAX_DISPLAY_LENGTH,
          );
          truncationToggle.textContent = "show more";

          e.stopPropagation();
          return;
        } else if (notesContent.getAttribute("aria-expanded") === "false") {
          notesContent.setAttribute("aria-expanded", "true");
          notesContent.textContent =
            notesContent.getAttribute("data-full-text");
          truncationToggle.textContent = "show less";

          e.stopPropagation();
          return;
        }
      }
    }
  }

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

      const noteTitle = listItem
        .querySelector(".notes-list-item__title")
        ?.getAttribute("title");
      const noteContent = listItem
        .querySelector(".notes-list-item__content")
        ?.getAttribute("data-full-text");
      if (!noteTitle || !noteContent) return;

      listItem.classList.add("editing");
      activeNoteId = listItem.id;
      notesTitleInput.value = noteTitle;
      notesInput.value = noteContent;
      notesInput.focus();

      e.stopPropagation();
      return;
    }
  }

  // DELETE NOTE
  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const listItem = deleteBtn.closest("li");
    if (!listItem) return;
    await actions.deleteNote(listItem.id);

    e.stopPropagation();
    return;
  }

  // COPY NOTE
  const listItem = e.target.closest(".notes-list-item");
  if (listItem) {
    const noteContent = listItem
      .querySelector(".notes-list-item__content")
      ?.getAttribute("data-full-text");
    if (noteContent) actions.copyNote(noteContent);
    showIndicator(listItem, "Copied");
    return;
  }
});

cancelEditBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  cleanUp();
});

actions.loadNotes();
chrome.storage.session.onChanged.addListener(() =>
  syncPendingNote((value) => actions.addNote("Untitled", value, null)),
);
