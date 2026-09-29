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
import { dateFormatter, truncateText } from "./utils.js";
export class NoteActions {
  notesList: HTMLElement;
  notesEmpty: HTMLElement;
  notesTemplate: HTMLTemplateElement;
  constructor(
    notesList: HTMLElement,
    notesEmpty: HTMLElement,
    notesTemplate: HTMLTemplateElement,
  ) {
    this.notesList = notesList;
    this.notesEmpty = notesEmpty;
    this.notesTemplate = notesTemplate;
  }

  async loadNotes() {
    try {
      const notes = await getNotesST();

      if (notes) {
        const sortedNotes = Object.entries(notes).toSorted((a, b) => {
          const dateA = new Date(a[1].updatedAt ?? a[1].createdAt);
          const dateB = new Date(b[1].updatedAt ?? b[1].createdAt);
          return dateA.getTime() - dateB.getTime();
        });

        const notesListEl = document.querySelector(".notes-list");
        if (notesListEl) {
          notesListEl.innerHTML = "";
          sortedNotes.forEach((entry) => {
            const note = {
              id: entry[0],
              ...entry[1],
            };

            this.#createNoteElement(note);
          });
        }
      }

      syncPendingNote((value) => this.addNote("Untitled", value, null));
    } catch (error) {
      console.error("Failed to load notes from local storage: ", error);
    } finally {
      this.#syncEmptyState();
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
        this.#createNoteElement(createdNote);
      }

      return createdNote;
    }
  }

  async deleteNote(noteId: string) {
    try {
      await deleteNoteST(noteId);

      document.getElementById(noteId)?.remove();
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

  #createNoteElement(note: Note) {
    const template = this.notesTemplate.content.cloneNode(
      true,
    ) as DocumentFragment;
    const listElement = template.querySelector(".notes-list-item");

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
        this.notesList.prepend(template);
        this.#syncEmptyState();
      }

      const notesDate = listElement.querySelector(".notes-list-item__date");
      if (notesDate) {
        const date = dateFormatter.format(
          new Date(note.updatedAt ?? note.createdAt),
        );
        notesDate.textContent = date;
      }
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

    this.loadNotes();
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
