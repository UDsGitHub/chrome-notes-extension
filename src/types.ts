export type CreateNoteDto = {
  title: string;
  content: string;
  tags?: string[];
};

export type NoteContent = CreateNoteDto & {
  createdAt: string;
  updatedAt?: string | null;
  /** Higher values appear closer to the top within the pinned/unpinned section. */
  order?: number;
  pinned?: boolean;
};

export type Note = {
  id: string;
} & NoteContent;

export type NotesList = Record<string, NoteContent>;
