import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getNotesST,
  addNoteST,
  deleteNoteST,
  syncPendingNote,
  updateNoteST,
} from "../storage.js";
import { PENDING_NOTE_KEY } from "../constants.js";
import type { NotesList } from "../types.js";

type StorageValue<T> = Record<string, T>;
interface StorageMedium<T> {
  items: StorageValue<T>;
  set: (value: StorageValue<T>) => Promise<void>;
  get: (key: string) => Promise<Record<string, T>>;
  remove: (key: string) => Promise<void>;
  reset: () => void;
}

const createStorage = <T>(): StorageMedium<T> => {
  return {
    items: {},
    async set(value: StorageValue<T>) {
      this.items = { ...this.items, ...value };
    },
    async get(key: string) {
      const value = this.items[key];
      return value ? { [key]: value } : ({} as Record<string, T>);
    },
    async remove(key: string) {
      delete this.items[key];
    },
    reset() {
      this.items = {};
    },
  };
};

const local = createStorage<NotesList>();
const session = createStorage<string>();

vi.stubGlobal("chrome", {
  storage: { local, session },
});

describe("storage", () => {
  beforeEach(() => {
    local.reset();
    session.reset();
  });

  describe("getNoteST", () => {
    it("returns null when storage is empty", async () => {
      expect(await getNotesST()).toBeNull();
    });
  });

  describe("addNoteST", () => {
    it("saves a note so getNotesST returns it", async () => {
      const note = {
        title: "Title",
        content: "first note",
      };

      const createdNote = await addNoteST(note);

      expect(createdNote).toBeDefined();
      expect(await getNotesST()).toEqual({
        [createdNote!.id]: { ...note, createdAt: expect.any(String) },
      });
    });

    it("updateNoteST", async () => {
      const note = {
        title: "Title",
        content: "first note",
      };

      const createdNote = await addNoteST(note);
      expect(createdNote).toBeDefined();
      expect(await getNotesST()).toEqual({
        [createdNote!.id]: { ...note, createdAt: expect.any(String) },
      });

      // @ts-expect-error: null check above
      const { id, ...rest } = createdNote;
      const updatedNote = await updateNoteST(id, {
        ...rest,
        content: "updated first note",
      });
      expect(updatedNote).toBeDefined();

      // @ts-expect-error: null check above
      const { id: updatedId, ...updatedRest } = updatedNote;
      expect(await getNotesST()).toEqual({
        [updatedId]: {
          ...updatedRest,
          updatedAt: expect.any(String),
        },
      });
    });
  });

  describe("syncPendingNote", () => {
    it("add pending note and clears session key", async () => {
      const note = {
        title: "Title",
        content: "first note",
      };
      await session.set({ [PENDING_NOTE_KEY]: note.content });

      const createdNote = await syncPendingNote((value: string) =>
        addNoteST({ ...note, content: value }),
      );
      expect(createdNote).toBeDefined();

      // @ts-expect-error: null check above
      const { id: _id, ...rest } = createdNote;
      expect(await getNotesST()).toEqual({ [createdNote!.id]: rest });
      expect(session.items[PENDING_NOTE_KEY]).toBeUndefined();
    });

    it("does nothing when pending note is missing", async () => {
      await syncPendingNote((value: string) =>
        addNoteST({ title: "Title", content: value }),
      );
      expect(await getNotesST()).toBeNull();
    });
  });

  describe("deleteNoteST", () => {
    it("deletes note by id", async () => {
      const note = {
        title: "First Note",
        content: "first note",
      };
      const note2 = {
        title: "Second Note",
        content: "second note",
      };

      const firstNote = await addNoteST(note);
      expect(firstNote).toBeDefined();
      const secondNote = await addNoteST(note2);
      expect(secondNote).toBeDefined();
      await deleteNoteST(secondNote!.id);
      const notes = await getNotesST();

      expect(notes).toBeDefined();
      // @ts-expect-error: null check above
      expect(notes[firstNote.id]).toBeDefined();
      // @ts-expect-error: should be undefined
      expect(notes[secondNote.id]).toBeUndefined();
    });
  });
});
