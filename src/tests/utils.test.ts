import { describe, expect, it } from "vitest";
import {
  collectUniqueTags,
  normalizeTags,
  noteMatchesFilters,
  noteMatchesQuery,
  parseTagsInput,
  serializeTagsCsv,
} from "../utils.js";

describe("normalizeTags", () => {
  it("trims, dedupes case-insensitively, and caps count", () => {
    expect(
      normalizeTags([" Work ", "work", "Ideas", "ideas", "a", "b", "c", "d", "e", "f", "g", "h"]),
    ).toEqual(["Work", "Ideas", "a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("parses comma and semicolon separated strings", () => {
    expect(parseTagsInput("work, ideas; personal")).toEqual([
      "work",
      "ideas",
      "personal",
    ]);
  });

  it("trims whitespace around each tag", () => {
    expect(parseTagsInput("personal, home")).toEqual(["personal", "home"]);
  });
});

describe("noteMatchesQuery", () => {
  const note = {
    title: "Grocery list",
    content: "Milk and eggs",
    tags: ["errands", "Home"],
  };

  it("matches title, content, and tags", () => {
    expect(noteMatchesQuery(note, "grocery")).toBe(true);
    expect(noteMatchesQuery(note, "eggs")).toBe(true);
    expect(noteMatchesQuery(note, "home")).toBe(true);
  });

  it("returns true for an empty query", () => {
    expect(noteMatchesQuery(note, "   ")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(noteMatchesQuery(note, "recipes")).toBe(false);
  });
});

describe("noteMatchesFilters", () => {
  const note = {
    title: "Grocery list",
    content: "Milk and eggs",
    tags: ["errands", "Home"],
  };

  it("scopes by exact tag then applies search", () => {
    expect(noteMatchesFilters(note, { tag: "home", query: "milk" })).toBe(true);
    expect(noteMatchesFilters(note, { tag: "home", query: "recipes" })).toBe(
      false,
    );
    expect(noteMatchesFilters(note, { tag: "work", query: "milk" })).toBe(
      false,
    );
  });

  it("treats a null tag as All", () => {
    expect(noteMatchesFilters(note, { tag: null, query: "eggs" })).toBe(true);
  });
});

describe("collectUniqueTags", () => {
  it("returns sorted unique tags across notes", () => {
    expect(
      collectUniqueTags({
        a: {
          title: "A",
          content: "a",
          createdAt: "2026-01-01T00:00:00.000Z",
          tags: ["Work", "ideas"],
        },
        b: {
          title: "B",
          content: "b",
          createdAt: "2026-01-01T00:00:00.000Z",
          tags: ["work", "personal"],
        },
      }),
    ).toEqual(["ideas", "personal", "Work"]);
  });
});

describe("serializeTagsCsv", () => {
  it("joins tags with semicolons", () => {
    expect(serializeTagsCsv(["work", "ideas"])).toBe("work;ideas");
  });
});
