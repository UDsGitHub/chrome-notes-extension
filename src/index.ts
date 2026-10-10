import { NoteActions } from "./actions.js";
import {
  LOADER_MIN_VISIBLE,
  LOADER_SHOW_DELAY,
  NOTE_BODY_MAX_DISPLAY_LENGTH,
} from "./constants.js";
import { exportCSV, exportJSON } from "./export.js";
import { parseNotes, type ImportFormat } from "./import.js";
import { Observable } from "./observable.js";
import { importNotesST, syncPendingNote } from "./storage.js";
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
const importOpenBtn = document.querySelector<HTMLButtonElement>("#import-open");
const importDialog = document.querySelector<HTMLDialogElement>("#import-dialog");
const importForm = document.querySelector<HTMLFormElement>("#import-form");
const importDropzone = document.querySelector<HTMLElement>("#import-dropzone");
const importDropzoneLabel = document.querySelector<HTMLElement>(
  "#import-dropzone-label",
);
const importFileInput = document.querySelector<HTMLInputElement>("#import-file");
const importTextInput = document.querySelector<HTMLTextAreaElement>("#import-text");
const importError = document.querySelector<HTMLElement>("#import-error");
const importCancelBtn =
  document.querySelector<HTMLButtonElement>("#import-cancel");
const importSubmitBtn =
  document.querySelector<HTMLButtonElement>("#import-submit");

const IMPORT_PLACEHOLDERS: Record<ImportFormat, string> = {
  json: '[{"id":"...","title":"...","content":"...","createdAt":"..."}]',
  csv: "id,title,content,createdAt,updatedAt",
};
const DROPZONE_DEFAULT_LABEL =
  "Drop a .json or .csv file here, or click to browse";

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
    importOpenBtn?.setAttribute("disabled", "");
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
    importOpenBtn?.removeAttribute("disabled");
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

type ImportButtonState = "default" | "loading" | "error" | "success";

const setImportButtonState = (
  state: ImportButtonState,
  errorMessage = "",
) => {
  if (!importSubmitBtn || !importError) return;

  importSubmitBtn.classList.remove("is-error", "is-success");
  importSubmitBtn.disabled = state === "loading";

  if (state === "loading") {
    importSubmitBtn.textContent = "Importing…";
    importError.hidden = true;
    importError.textContent = "";
    return;
  }

  if (state === "error") {
    importSubmitBtn.textContent = "Import";
    importSubmitBtn.classList.add("is-error");
    importError.hidden = false;
    importError.textContent = errorMessage;
    return;
  }

  if (state === "success") {
    importSubmitBtn.textContent = "Imported";
    importSubmitBtn.classList.add("is-success");
    importError.hidden = true;
    importError.textContent = "";
    return;
  }

  importSubmitBtn.textContent = "Import";
  importError.hidden = true;
  importError.textContent = "";
};

const getPasteFormat = (): ImportFormat => {
  const selected = importForm?.querySelector<HTMLInputElement>(
    'input[name="import-format"]:checked',
  );
  return selected?.value === "csv" ? "csv" : "json";
};

const syncPastePlaceholder = () => {
  if (!importTextInput) return;
  importTextInput.placeholder = IMPORT_PLACEHOLDERS[getPasteFormat()];
};

const syncDropzoneLabel = (file?: File | null) => {
  if (!importDropzone || !importDropzoneLabel) return;

  if (file) {
    importDropzone.classList.add("has-file");
    importDropzoneLabel.textContent = file.name;
    return;
  }

  importDropzone.classList.remove("has-file");
  importDropzoneLabel.textContent = DROPZONE_DEFAULT_LABEL;
};

const setImportFile = (file: File | null) => {
  if (!importFileInput) return;

  if (!file) {
    importFileInput.value = "";
    syncDropzoneLabel(null);
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  importFileInput.files = transfer.files;
  syncDropzoneLabel(file);
};

const resetImportForm = () => {
  importForm?.reset();
  importDropzone?.classList.remove("is-dragover");
  syncDropzoneLabel(null);
  syncPastePlaceholder();
  setImportButtonState("default");
};

const importResultMessage = (imported: number, skipped: number) => {
  if (imported > 0 && skipped > 0) {
    return `Imported ${imported} notes. Skipped ${skipped} that already exist.`;
  }
  if (imported > 0) {
    return `Imported ${imported} notes.`;
  }
  return `No notes imported. ${skipped} already exist.`;
};

const handleImportSubmit = async (e: SubmitEvent) => {
  e.preventDefault();

  const file = importFileInput?.files?.[0] ?? null;
  const pasted = importTextInput?.value ?? "";

  setImportButtonState("loading");

  try {
    const notes = file
      ? parseNotes(await file.text(), { filename: file.name })
      : parseNotes(pasted, { format: getPasteFormat() });
    const { imported, skipped } = await importNotesST(notes);

    if (imported > 0) {
      setImportButtonState("success");
      await actions.loadNotes();
      toaster.toast(importResultMessage(imported, skipped));
      window.setTimeout(() => {
        importDialog?.close();
        resetImportForm();
      }, 600);
      return;
    }

    setImportButtonState("default");
    toaster.toast(importResultMessage(imported, skipped), "warning");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    setImportButtonState("error", message);
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

importOpenBtn?.addEventListener("click", () => {
  resetImportForm();
  importDialog?.showModal();
});

importCancelBtn?.addEventListener("click", () => {
  importDialog?.close();
  resetImportForm();
});

importForm?.addEventListener("submit", handleImportSubmit);

importDropzone?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    importFileInput?.click();
  }
});

importDropzone?.addEventListener("dragenter", (e) => {
  e.preventDefault();
  importDropzone.classList.add("is-dragover");
});

importDropzone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  importDropzone.classList.add("is-dragover");
});

importDropzone?.addEventListener("dragleave", (e) => {
  if (
    e.relatedTarget instanceof Node &&
    importDropzone.contains(e.relatedTarget)
  ) {
    return;
  }
  importDropzone.classList.remove("is-dragover");
});

importDropzone?.addEventListener("drop", (e) => {
  e.preventDefault();
  importDropzone.classList.remove("is-dragover");
  const file = e.dataTransfer?.files?.[0] ?? null;
  if (!file) return;
  setImportFile(file);
  setImportButtonState("default");
});

importFileInput?.addEventListener("change", () => {
  syncDropzoneLabel(importFileInput.files?.[0] ?? null);
  setImportButtonState("default");
});

importTextInput?.addEventListener("input", () => {
  setImportButtonState("default");
});

importForm?.addEventListener("change", (e) => {
  if (!(e.target instanceof HTMLInputElement)) return;
  if (e.target.name !== "import-format") return;
  syncPastePlaceholder();
  setImportButtonState("default");
});

importDialog?.addEventListener("close", () => {
  resetImportForm();
});

// INIT

actions.loadNotes();
chrome.storage.session.onChanged.addListener(() =>
  syncPendingNote((value) => actions.addNote("Untitled", value, null)),
);
