export type CreateNoteDto = {
  title: string;
  content: string;
};

export type NoteContent = CreateNoteDto & {
  createdAt: string;
  updatedAt?: string | null;
  /** Higher values appear closer to the top of the list. */
  order?: number;
};

export type Note = {
  id: string;
} & NoteContent;

export type NotesList = Record<string, NoteContent>;
