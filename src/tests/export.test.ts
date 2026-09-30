import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSortedNotes } from "../utils.js";
import { exportCSV, exportJSON } from "../export.js";

const { getNotesST } = vi.hoisted(() => ({
  getNotesST: vi.fn(),
}));
vi.mock("../storage.js", () => ({ getNotesST }));

const download = vi.fn();
const addListener = vi.fn();
const removeListener = vi.fn();
const search = vi.fn();

globalThis.chrome = {
  downloads: {
    download,
    onChanged: {
      addListener,
      removeListener,
    },
    search,
  },
} as unknown as typeof chrome;

/** Simulate chrome.downloads.onChanged firing when the listener is registered. */
function mockDownloadState(
  state: "complete" | "interrupted" | null,
  downloadId = 1,
  searchResults: { id: number; state: "complete" | "interrupted" }[] = [],
) {
  download.mockResolvedValue(downloadId);
  search.mockResolvedValue(searchResults);
  addListener.mockImplementation(
    (listener: (delta: chrome.downloads.DownloadDelta) => void) => {
      if (!state) return;

      listener({
        id: downloadId,
        state: { current: state, previous: "in_progress" },
      });
    },
  );
}

describe("Export CSV or JSON", () => {
  let lastBlob: Blob | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    lastBlob = undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      lastBlob = blob as Blob;
      return "blob:mock-url";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("sorts notes correctly", () => {
    const sortedNotes = getSortedNotes({
      "1": {
        title: "title-1",
        content: "content",
        createdAt: new Date("09/10/2026").toISOString(),
      },
      "2": {
        title: "title-2",
        content: "content",
        createdAt: new Date("09/15/2026").toISOString(),
        updatedAt: new Date("09/16/2026").toISOString(),
      },
      "3": {
        title: "title-2",
        content: "content",
        createdAt: new Date("09/15/2026").toISOString(),
      },
    });

    expect(sortedNotes).toHaveLength(3);
    expect(sortedNotes[0]?.[0]).toEqual("1");
    expect(sortedNotes[1]?.[0]).toEqual("3");
    expect(sortedNotes[2]?.[0]).toEqual("2");
  });

  it("downloads JSON for notes from storage", async () => {
    const createdAt = new Date("09/10/2026").toISOString();
    getNotesST.mockResolvedValue({
      "1": {
        title: "title-1",
        content: "content",
        createdAt,
      },
    });
    mockDownloadState("complete", 1);

    await exportJSON();

    expect(getNotesST).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "clip-notes_notes.json",
        saveAs: false,
        url: "blob:mock-url",
      }),
    );
    expect(addListener).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledOnce();

    const json = await lastBlob!.text();
    expect(JSON.parse(json)).toEqual([
      { id: "1", title: "title-1", content: "content", createdAt },
    ]);
  });

  it("rejects when the download is interrupted", async () => {
    getNotesST.mockResolvedValue(null);
    mockDownloadState("interrupted", 1);

    await expect(exportJSON()).rejects.toThrow("Download interrupted.");
    expect(removeListener).toHaveBeenCalledOnce();
  });

  it("confirms download from downloads.search if completed before onchange event", async () => {
    getNotesST.mockResolvedValue(null);
    mockDownloadState(null, 1, [{ id: 1, state: "complete" }]);

    await exportJSON();

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "clip-notes_notes.json",
        saveAs: false,
        url: expect.stringMatching(/^blob:/),
      }),
    );
    expect(addListener).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledOnce();
  });

  it("rejects from downloads.search if interrupted before onchange event", async () => {
    getNotesST.mockResolvedValue(null);
    mockDownloadState(null, 1, [{ id: 1, state: "interrupted" }]);

    await expect(exportJSON()).rejects.toThrow("Download interrupted");

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "clip-notes_notes.json",
        saveAs: false,
        url: expect.stringMatching(/^blob:/),
      }),
    );
    expect(addListener).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledOnce();
  });

  it("escapes quotes and wraps fields in CSV output", async () => {
    const createdAt = new Date("09/10/2026").toISOString();
    getNotesST.mockResolvedValue({
      "1": {
        title: "Hello, World",
        content: 'And he said "I am your father..."',
        createdAt,
      },
    });
    mockDownloadState("complete", 1);

    await exportCSV();

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "clip-notes_notes.csv",
        url: "blob:mock-url",
      }),
    );

    const csv = await lastBlob!.text();
    expect(csv).toBe(
      [
        "id,title,content,createdAt,updatedAt",
        `"1","Hello, World","And he said ""I am your father...""","${createdAt}",""`,
      ].join("\n"),
    );
  });
});
