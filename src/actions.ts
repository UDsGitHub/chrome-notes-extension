import { NOTE_BODY_MAX_DISPLAY_LENGTH } from "./constants.js";
import {
  getNotesST,
  saveNoteST,
  deleteNoteST,
  syncPendingNote,
} from "./storage.js";
import type { Note } from "./types.js";
import { truncateText } from "./utils.js";
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

  async loadNotes(activeNoteId: string | null) {
    try {
      const notes = await getNotesST();

      if (notes) {
        Object.entries(notes).forEach((entry) => {
          const note = {
            id: entry[0],
            content: entry[1],
          };

          this.#createNoteElement(note);
        });
      }

      syncPendingNote((value) => this.addNote(value, activeNoteId));
    } catch (error) {
      console.error("Failed to load notes from local storage: ", error);
    } finally {
      this.#syncEmptyState();
    }
  }

  async addNote(value: string, activeNoteId: string | null) {
    const id = activeNoteId ?? `note-${crypto.randomUUID()}`;
    const note = {
      id,
      content: value,
    };

    await saveNoteST(note);
    if (activeNoteId) {
      this.#updateNoteElement(note);
    } else {
      this.#createNoteElement(note);
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
      const notesContent = template.querySelector(".notes-list-item__content");
      if (notesContent) {
        const toggleBtn = listElement.querySelector(
          ".notes-list-item__truncateToggle",
        );
        this.#setTruncatedState(note.content, notesContent, toggleBtn);
        this.notesList.appendChild(template);
        this.#syncEmptyState();
      }
    }
  }

  #updateNoteElement(note: Note) {
    const noteElement = document.getElementById(note.id);
    const notesContent = noteElement?.querySelector(
      ".notes-list-item__content",
    );
    if (notesContent) {
      const toggleBtn = noteElement?.querySelector(
        ".notes-list-item__truncateToggle",
      );
      this.#setTruncatedState(note.content, notesContent, toggleBtn);
      notesContent.setAttribute("data-full-text", note.content);
    }
  }

  #setTruncatedState(
    content: string,
    notesContentEl: Element,
    toggleBtn?: Element | null,
  ) {
    notesContentEl.setAttribute("data-full-text", content);
    const truncatedText = truncateText(content, NOTE_BODY_MAX_DISPLAY_LENGTH);
    if (truncatedText.length > NOTE_BODY_MAX_DISPLAY_LENGTH) {
      toggleBtn?.classList.add("visible");
      notesContentEl.setAttribute("aria-expanded", "false");
    }
    notesContentEl.textContent = truncatedText;
  }
}
