import { NoteActions } from "./actions.js";
import {
  LOADER_MIN_VISIBLE,
  LOADER_SHOW_DELAY,
  NOTE_BODY_MAX_DISPLAY_LENGTH,
} from "./constants.js";
import { exportCSV, exportJSON } from "./export.js";
import { Observable } from "./observable.js";
import { syncPendingNote } from "./storage.js";
import { Toaster } from "./toast.js";
import { truncateText } from "./utils.js";

// ELEMENTS

const form = document.getElementById("notes-form") as HTMLFormElement;
const notesTitleInput = document.getElementById(
  "notes-title-input",
) as HTMLInputElement;
const notesInput = document.getElementById(
  "notes-input",
) as HTMLTextAreaElement;
const notesListWrapper = document.querySelector<HTMLElement>(
  ".notes-list__wrapper",
);
const notesList = document.querySelector(".notes-list") as HTMLElement;
const notesTemplate = document.getElementById(
  "notes-list-item__template",
) as HTMLTemplateElement;
const notesEmpty = document.querySelector(".notes-empty") as HTMLElement;
const cancelEditBtn = document.querySelector<HTMLElement>(".cancel-edit-btn");
const exportPopover = document.querySelector<HTMLElement>("#export-popover");
const loadingDialog = document.querySelector<HTMLDialogElement>("#loader");

// STATE

let activeNoteId: string | null = null;
const actions = new NoteActions(notesList, notesEmpty, notesTemplate);
const indicatorTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
const toaster = new Toaster(notesListWrapper);
const isLoading = new Observable<boolean>(false);

// OBSERVERS

isLoading.subscribe((value) => {
  if (value) {
    document.querySelector(".export-btn")?.setAttribute("disabled", "");
    document
      .querySelectorAll<HTMLElement>(".notes-list-item")
      .forEach((item) => {
        item.style.setProperty("pointer-events", "none");
        item.classList.add("disabled");
      });
    notesTitleInput?.setAttribute("disabled", "");
    notesInput?.setAttribute("disabled", "");
    cancelEditBtn?.setAttribute("disabled", "");
    document.querySelector("#notes-input-submit")?.setAttribute("disabled", "");
  } else {
    document.querySelector(".export-btn")?.removeAttribute("disabled");
    document
      .querySelectorAll<HTMLElement>(".notes-list-item")
      .forEach((item) => {
        item.style.removeProperty("pointer-events");
        item.classList.remove("disabled");
      });
    notesTitleInput?.removeAttribute("disabled");
    notesInput?.removeAttribute("disabled");
    cancelEditBtn?.removeAttribute("disabled");
    document.querySelector("#notes-input-submit")?.removeAttribute("disabled");
  }
});

// HELPERS

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

const processAsync = async (
  action: () => Promise<void>,
  onSuccess?: () => void,
  onError?: () => void,
) => {
  let errorMessage = "";
  let loaderShown = false;
  let loaderShownAt = 0;

  isLoading.set(true);

  const showTimer = setTimeout(() => {
    loaderShown = true;
    loaderShownAt = Date.now();
    loadingDialog?.showModal();
  }, LOADER_SHOW_DELAY);

  try {
    await action();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Something went wrong.";
  }

  clearTimeout(showTimer);
  
  if (loaderShown) {
    const visibleFor = Date.now() - loaderShownAt;
    const remaining = LOADER_MIN_VISIBLE - visibleFor;
    if (remaining > 0) {
      await new Promise((r) => setTimeout(r, remaining));
    }
    loadingDialog?.requestClose();
  }

  isLoading.set(false);
  
  if (errorMessage && onError) {
    onError();
  } else if (errorMessage) {
    toaster.toast(errorMessage, "error");
  } else {
    onSuccess?.();
  }
};

// HANDLERS

const handleTruncationToggle = (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

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
};

const handleEditNoteClick = (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

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
};

const handleDeleteNoteClick = async (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const listItem = deleteBtn.closest("li");
    if (!listItem) return;
    await actions.deleteNote(listItem.id);

    e.stopPropagation();
    return;
  }
};

const handleCopyNoteClick = (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

  const listItem = e.target.closest(".notes-list-item");
  if (listItem) {
    const noteContent = listItem
      .querySelector(".notes-list-item__content")
      ?.getAttribute("data-full-text");
    if (noteContent) actions.copyNote(noteContent);
    showIndicator(listItem, "Copied");
    return;
  }
};

const handleCsvExport = async (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

  const exportCsvBtn = e.target.closest("#export-csv");
  if (exportCsvBtn) {
    exportPopover?.hidePopover();
    processAsync(exportCSV, () => {
      toaster.toast("CSV downloaded.");
    });
  }
};

const handleJsonExport = async (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

  const exportJsonBtn = e.target.closest("#export-json");
  if (exportJsonBtn) {
    exportPopover?.hidePopover();
    processAsync(exportJSON, () => {
      toaster.toast("JSON downloaded.");
    });
  }
};

// LISTENERS

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

notesList?.addEventListener("click", async (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

  // TOGGLE TRUNCATION
  handleTruncationToggle(e);

  // EDIT NOTE
  handleEditNoteClick(e);

  // DELETE NOTE
  await handleDeleteNoteClick(e);

  // COPY NOTE
  handleCopyNoteClick(e);
});

cancelEditBtn?.addEventListener("click", (e: PointerEvent) => {
  e.preventDefault();
  cleanUp();
});

exportPopover?.addEventListener("click", async (e: PointerEvent) => {
  if (!(e.target instanceof Element)) return;

  handleCsvExport(e);
  handleJsonExport(e);
});

// INIT

actions.loadNotes();
chrome.storage.session.onChanged.addListener(() =>
  syncPendingNote((value) => actions.addNote("Untitled", value, null)),
);
