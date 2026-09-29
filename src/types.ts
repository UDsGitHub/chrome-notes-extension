export type CreateNoteDto = {
  title: string;
  content: string;
};

export type NoteContent = CreateNoteDto & {
  createdAt: string;
  updatedAt?: string | null;
};

export type Note = {
  id: string;
} & NoteContent;

export type NotesList = Record<string, NoteContent>;
