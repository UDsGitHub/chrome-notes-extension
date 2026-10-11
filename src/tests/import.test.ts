import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseNotes } from "../import.js";
import { importNotesST } from "../storage.js";
import { NOTES_STORAGE_KEY } from "../constants.js";
import type { Note, NotesList } from "../types.js";

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

vi.stubGlobal("chrome", {
  storage: { local, session: createStorage<string>() },
});

const createdAt = "2026-09-10T12:00:00.000Z";
const updatedAt = "2026-09-16T12:00:00.000Z";

const sampleNotes: Note[] = [
  {
    id: "1",
    title: "Hello, World",
    content: 'And he said "I am your father..."',
    createdAt,
    pinned: false,
    tags: [],
  },
  {
    id: "2",
    title: "Second",
    content: "more content",
    createdAt,
    updatedAt,
    pinned: false,
    tags: [],
  },
];

const sampleJSON = JSON.stringify(
  [
    {
      id: "1",
      title: "Hello, World",
      content: 'And he said "I am your father..."',
      createdAt,
    },
    {
      id: "2",
      title: "Second",
      content: "more content",
      createdAt,
      updatedAt,
    },
  ],
  undefined,
  2,
);

const sampleCSV = [
  "id,title,content,createdAt,updatedAt",
  `"1","Hello, World","And he said ""I am your father...""","${createdAt}",""`,
  `"2","Second","more content","${createdAt}","${updatedAt}"`,
].join("\n");

describe("parseNotes", () => {
  it("parses JSON that matches an export", () => {
    expect(
      parseNotes(sampleJSON, { filename: "clip-notes_notes.json" }),
    ).toEqual(sampleNotes);
  });

  it("parses pasted JSON when format is json", () => {
    expect(parseNotes(sampleJSON, { format: "json" })).toEqual(sampleNotes);
  });

  it("parses CSV that matches an export, including commas and quotes", () => {
    expect(parseNotes(sampleCSV, { filename: "clip-notes_notes.csv" })).toEqual(
      sampleNotes,
    );
  });

  it("parses pasted CSV when format is csv", () => {
    expect(parseNotes(sampleCSV, { format: "csv" })).toEqual(sampleNotes);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseNotes("[{", { filename: "notes.json" })).toThrow(
      "Invalid JSON.",
    );
  });

  it("rejects JSON that is not an array", () => {
    expect(() => parseNotes('{"id":"1"}', { filename: "notes.json" })).toThrow(
      "JSON must be an array of notes.",
    );
  });

  it("rejects a bad CSV header", () => {
    expect(() =>
      parseNotes('id,title\n"1","a"', { filename: "notes.csv" }),
    ).toThrow(
      "CSV header must be id,title,content,createdAt,updatedAt,order,pinned,tags.",
    );
  });

  it("parses CSV with an order column", () => {
    const csv = [
      "id,title,content,createdAt,updatedAt,order",
      `"1","Hello, World","And he said ""I am your father...""","${createdAt}","",3`,
    ].join("\n");

    expect(parseNotes(csv, { format: "csv" })).toEqual([
      {
        id: "1",
        title: "Hello, World",
        content: 'And he said "I am your father..."',
        createdAt,
        order: 3,
        pinned: false,
        tags: [],
      },
    ]);
  });

  it("parses CSV with a pinned column", () => {
    const csv = [
      "id,title,content,createdAt,updatedAt,order,pinned",
      `"1","Hello, World","And he said ""I am your father...""","${createdAt}","",3,true`,
    ].join("\n");

    expect(parseNotes(csv, { format: "csv" })).toEqual([
      {
        id: "1",
        title: "Hello, World",
        content: 'And he said "I am your father..."',
        createdAt,
        order: 3,
        pinned: true,
        tags: [],
      },
    ]);
  });

  it("parses CSV with a tags column", () => {
    const csv = [
      "id,title,content,createdAt,updatedAt,order,pinned,tags",
      `"1","Hello, World","And he said ""I am your father...""","${createdAt}","",3,false,"work;ideas"`,
    ].join("\n");

    expect(parseNotes(csv, { format: "csv" })).toEqual([
      {
        id: "1",
        title: "Hello, World",
        content: 'And he said "I am your father..."',
        createdAt,
        order: 3,
        pinned: false,
        tags: ["work", "ideas"],
      },
    ]);
  });

  it("defaults missing pinned and tags in JSON", () => {
    const json = JSON.stringify([
      { id: "1", title: "a", content: "b", createdAt },
    ]);

    expect(parseNotes(json, { format: "json" })).toEqual([
      {
        id: "1",
        title: "a",
        content: "b",
        createdAt,
        pinned: false,
        tags: [],
      },
    ]);
  });

  it("rejects a row missing a title", () => {
    const csv = [
      "id,title,content,createdAt,updatedAt",
      `"1","","content","${createdAt}",""`,
    ].join("\n");

    expect(() => parseNotes(csv, { filename: "notes.csv" })).toThrow(
      "Row 2 is missing a title.",
    );
  });

  it("rejects a row with an invalid createdAt", () => {
    const csv = [
      "id,title,content,createdAt,updatedAt",
      `"1","title","content","not-a-date",""`,
    ].join("\n");

    expect(() => parseNotes(csv, { filename: "notes.csv" })).toThrow(
      "Row 2 has an invalid createdAt.",
    );
  });

  it("rejects duplicate ids in the file", () => {
    const json = JSON.stringify([
      { id: "1", title: "a", content: "b", createdAt },
      { id: "1", title: "c", content: "d", createdAt },
    ]);

    expect(() => parseNotes(json, { filename: "notes.json" })).toThrow(
      "Duplicate id in import: 1.",
    );
  });

  it("rejects empty input", () => {
    expect(() => parseNotes("   ", { format: "json" })).toThrow(
      "Nothing to import.",
    );
  });

  it("rejects files that are not json or csv", () => {
    expect(() => parseNotes(sampleJSON, { filename: "notes.txt" })).toThrow(
      "File must be .json or .csv.",
    );
  });
});

describe("importNotesST", () => {
  beforeEach(() => {
    local.reset();
  });

  it("imports new notes and skips existing ids", async () => {
    local.items[NOTES_STORAGE_KEY] = {
      "1": {
        title: "Existing",
        content: "keep me",
        createdAt,
        order: 0,
      },
    };

    const result = await importNotesST(sampleNotes);

    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(local.items[NOTES_STORAGE_KEY]).toEqual({
      "1": {
        title: "Existing",
        content: "keep me",
        createdAt,
        order: 0,
      },
      "2": {
        title: "Second",
        content: "more content",
        createdAt,
        updatedAt,
        order: 1,
        pinned: false,
        tags: [],
      },
    });
  });

  it("writes nothing when every id already exists", async () => {
    const existing: NotesList = {
      "1": {
        title: "Existing",
        content: "keep me",
        createdAt,
        order: 0,
      },
      "2": {
        title: "Also existing",
        content: "keep me too",
        createdAt,
        order: 1,
      },
    };
    local.items[NOTES_STORAGE_KEY] = { ...existing };
    const setSpy = vi.spyOn(local, "set");

    const result = await importNotesST(sampleNotes);

    expect(result).toEqual({ imported: 0, skipped: 2 });
    expect(setSpy).not.toHaveBeenCalled();
    expect(local.items[NOTES_STORAGE_KEY]).toEqual(existing);
  });

  it("imports all notes when storage is empty", async () => {
    const result = await importNotesST(sampleNotes);

    expect(result).toEqual({ imported: 2, skipped: 0 });
    expect(local.items[NOTES_STORAGE_KEY]).toEqual({
      "1": {
        title: "Hello, World",
        content: 'And he said "I am your father..."',
        createdAt,
        order: 0,
        pinned: false,
        tags: [],
      },
      "2": {
        title: "Second",
        content: "more content",
        createdAt,
        updatedAt,
        order: 1,
        pinned: false,
        tags: [],
      },
    });
  });

  it("imports pinned notes into the pinned order lane", async () => {
    const result = await importNotesST([
      {
        id: "pinned-1",
        title: "Pinned",
        content: "keep me up",
        createdAt,
        pinned: true,
      },
      {
        id: "unpinned-1",
        title: "Unpinned",
        content: "below",
        createdAt,
        pinned: false,
      },
    ]);

    expect(result).toEqual({ imported: 2, skipped: 0 });
    expect(local.items[NOTES_STORAGE_KEY]).toEqual({
      "pinned-1": {
        title: "Pinned",
        content: "keep me up",
        createdAt,
        order: 0,
        pinned: true,
        tags: [],
      },
      "unpinned-1": {
        title: "Unpinned",
        content: "below",
        createdAt,
        order: 0,
        pinned: false,
        tags: [],
      },
    });
  });
});
