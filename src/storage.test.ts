import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getNotesST,
  saveNoteST,
  deleteNoteST,
  syncPendingNote,
} from "./storage.js";
import { PENDING_NOTE_KEY } from "./constants.js";
import type { NotesList } from "./types.js";

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

  describe("saveNoteST", () => {
    it("saves a note so getNotesST returns it", async () => {
      const id = `note-${crypto.randomUUID()}`;
      const note = {
        id,
        content: "first note",
      };

      await saveNoteST(note);
      expect(await getNotesST()).toEqual({ [id]: "first note" });
    });

    it("updates an existing note by id", async () => {
      const id = `note-${crypto.randomUUID()}`;
      const note = {
        id,
        content: "first note",
      };

      await saveNoteST(note);
      expect(await getNotesST()).toEqual({ [id]: "first note" });
      note.content = "updated first note";
      await saveNoteST(note);
      expect(await getNotesST()).toEqual({ [id]: "updated first note" });
    });
  });

  describe("syncPendingNote", () => {
    it("add pending note and clears session key", async () => {
      const id = `note-${crypto.randomUUID()}`;
      const note = {
        id,
        content: "first note",
      };
      await session.set({ [PENDING_NOTE_KEY]: note.content });

      await syncPendingNote((value: string) =>
        saveNoteST({ ...note, content: value }),
      );
      expect(await getNotesST()).toEqual({ [id]: "first note" });
      expect(session.items[PENDING_NOTE_KEY]).toBeUndefined();
    });

    it("does nothing when pending note is missing", async () => {
      await syncPendingNote((value: string) =>
        saveNoteST({ id: "1", content: value }),
      );
      expect(await getNotesST()).toBeNull();
    });
  });

  describe("deleteNoteST", () => {
    it("deletes note by id", async () => {
      const id = `note-${crypto.randomUUID()}`;
      const note = {
        id,
        content: "first note",
      };
      const id2 = `note-${crypto.randomUUID()}`;
      const note2 = {
        id: id2,
        content: "second note",
      };

      await saveNoteST(note);
      await saveNoteST(note2);
      await deleteNoteST(id2);
      const notes = await getNotesST();

      expect(notes).toBeDefined();
      // @ts-expect-error: null check above
      expect(notes[id]).toBeDefined();
      // @ts-expect-error: should be undefined
      expect(notes[id2]).toBeUndefined();
    });
  });
});
