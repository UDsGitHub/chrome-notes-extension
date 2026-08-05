export type ElementWithHidden = Element & {
  hidden: boolean;
};

export type Note = {
    id: string;
    content: string;
}

export type NotesList = Record<string, string>