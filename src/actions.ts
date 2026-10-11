import {
  NOTE_BODY_MAX_DISPLAY_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
} from "./constants.js";
import {
  getNotesST,
  addNoteST,
  deleteNoteST,
  syncPendingNote,
  updateNoteST,
} from "./storage.js";
import type { Note } from "./types.js";
import { dateFormatter, getSortedNotes, truncateText } from "./utils.js";

export class NoteActions {
  notesList: HTMLElement;
  notesEmpty: HTMLElement;
  notesTemplate: HTMLTemplateElement;
  onListRebuilt: (() => void) | undefined;

  constructor(
    notesList: HTMLElement,
    notesEmpty: HTMLElement,
    notesTemplate: HTMLTemplateElement,
    onListRebuilt?: () => void,
  ) {
    this.notesList = notesList;
    this.notesEmpty = notesEmpty;
    this.notesTemplate = notesTemplate;
    this.onListRebuilt = onListRebuilt;
  }

  async loadNotes(options: { animate?: boolean } = {}) {
    try {
      const notes = await getNotesST();

      if (notes) {
        const sortedNotes = getSortedNotes(notes);

        this.notesList.innerHTML = "";
        sortedNotes.forEach((entry) => {
          const note = {
            id: entry[0],
            ...entry[1],
          };

          this.#createNoteElement(note, {
            animate: options.animate ?? false,
            placement: "end",
          });
        });
      }

      syncPendingNote((value) => this.addNote("Untitled", value, null));
    } catch (error) {
      console.error("Failed to load notes from local storage: ", error);
    } finally {
      this.#syncEmptyState();
      this.onListRebuilt?.();
    }
  }

  async addNote(title: string, content: string, activeNoteId: string | null) {
    if (activeNoteId) {
      const updatedNote = await updateNoteST(activeNoteId, {
        title,
        content,
      });
      if (updatedNote) {
        this.#updateNoteElement(updatedNote);
      }

      return updatedNote;
    } else {
      const createdNote = await addNoteST({
        title,
        content,
      });
      if (createdNote) {
        this.#createNoteElement(createdNote, {
          animate: true,
          placement: "start",
        });
      }

      return createdNote;
    }
  }

  async deleteNote(noteId: string) {
    try {
      const listElement = document.getElementById(noteId);
      if (listElement?.classList.contains("is-exiting")) return;

      await deleteNoteST(noteId);

      if (!listElement) {
        this.#syncEmptyState();
        return;
      }

      await this.#animateNoteExit(listElement);
      listElement.remove();
      this.#syncEmptyState();
    } catch (error) {
      console.error("Failed to delete note: ", error);
    }
  }

  async copyNote(value: string) {
    navigator.clipboard.writeText(value).catch((err) => {
      console.error("Failed to copy text: ", err);
    });
  }

  // HELPERS

  #syncEmptyState() {
    const hasNotes = this.notesList.children.length > 0;
    this.notesEmpty.hidden = hasNotes;
    this.notesList.hidden = !hasNotes;
  }

  #createNoteElement(
    note: Note,
    options: { animate?: boolean; placement?: "start" | "end" } = {},
  ) {
    const template = this.notesTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;
    const listElement = template.querySelector<HTMLElement>(".notes-list-item");

    if (listElement) {
      listElement.id = note.id;

      const notesTitle = listElement.querySelector(".notes-list-item__title");
      if (notesTitle) {
        const truncatedTitle = truncateText(note.title, NOTE_TITLE_MAX_LENGTH);
        notesTitle.textContent = truncatedTitle;
        notesTitle.setAttribute("title", note.title);
      }

      const notesContent = listElement.querySelector(
        ".notes-list-item__content",
      );
      if (notesContent) {
        const toggleBtn = listElement.querySelector(
          ".notes-list-item__truncateToggle",
        );
        this.#setTruncatedState(note.content, notesContent, toggleBtn);
      }

      const notesDate = listElement.querySelector(".notes-list-item__date");
      if (notesDate) {
        const date = dateFormatter.format(
          new Date(note.updatedAt ?? note.createdAt),
        );
        notesDate.textContent = date;
      }

      if (options.animate) {
        listElement.classList.add("is-entering");
        const onEnterEnd = (e: AnimationEvent) => {
          if (e.target !== listElement) return;
          listElement.removeEventListener("animationend", onEnterEnd);
          listElement.classList.remove("is-entering");
        };
        listElement.addEventListener("animationend", onEnterEnd);
      }

      if (options.placement === "end") {
        this.notesList.append(template);
      } else {
        this.notesList.prepend(template);
      }
      this.#syncEmptyState();
    }
  }

  #updateNoteElement(note: Note) {
    const listElement = document.getElementById(note.id);
    if (!listElement) return;

    const notesTitle = listElement.querySelector(".notes-list-item__title");
    if (notesTitle) {
      const truncatedTitle = truncateText(note.title, NOTE_TITLE_MAX_LENGTH);
      notesTitle.textContent = truncatedTitle;
      notesTitle.setAttribute("title", note.title);
    }

    const notesContent = listElement.querySelector(".notes-list-item__content");
    if (notesContent) {
      const toggleBtn = listElement.querySelector(
        ".notes-list-item__truncateToggle",
      );
      this.#setTruncatedState(note.content, notesContent, toggleBtn);
    }

    const notesDate = listElement.querySelector(".notes-list-item__date");
    if (notesDate) {
      const date = dateFormatter.format(
        new Date(note.updatedAt ?? note.createdAt),
      );
      notesDate.textContent = date;
    }
  }

  #animateNoteExit(listElement: HTMLElement) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        listElement.removeEventListener("animationend", onExitEnd);
        resolve();
      };
      const onExitEnd = (e: AnimationEvent) => {
        if (e.target === listElement) finish();
      };

      listElement.classList.add("is-exiting");
      listElement.addEventListener("animationend", onExitEnd);
      const fallbackTimer = window.setTimeout(finish, 250);
    });
  }

  #setTruncatedState(
    content: string,
    notesContentEl: Element,
    toggleBtn?: Element | null,
  ) {
    notesContentEl.setAttribute("data-full-text", content);
    const truncatedText = truncateText(content, NOTE_BODY_MAX_DISPLAY_LENGTH);
    if (content.length > NOTE_BODY_MAX_DISPLAY_LENGTH) {
      toggleBtn?.classList.add("visible");
      notesContentEl.setAttribute("aria-expanded", "false");
    } else {
      toggleBtn?.classList.remove("visible");
    }
    notesContentEl.textContent = truncatedText;
  }
}
