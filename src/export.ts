import { getNotesST } from "./storage.js";
import type { Note } from "./types.js";
import { getSortedNotes } from "./utils.js";

export async function exportJSON() {
  try {
    const notes = await getNotesST();

    let exportNotes: Note[] = [];
    if (notes) {
      const sortedNotes = getSortedNotes(notes);
      exportNotes = sortedNotes
        .toReversed()
        .map(([id, noteDetails]) => ({ id, ...noteDetails }));
    }

    await downloadText(
      "clip-notes_notes.json",
      JSON.stringify(exportNotes, undefined, 2),
      "application/json",
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Download interrupted.") {
      throw error;
    }
    throw new Error("Error downloading JSON notes", { cause: error });
  }
}

export async function exportCSV() {
  try {
    const notes = await getNotesST();

    const csv = ["id,title,content,createdAt,updatedAt"];
    if (notes) {
      const sortedNotes = getSortedNotes(notes).toReversed();

      for (const noteEntry of sortedNotes) {
        const [id, note] = noteEntry;
        csv.push(
          `"${id}",${escapeText(note.title)},${escapeText(note.content)},${escapeText(note.createdAt)},${escapeText(note.updatedAt ?? "")}`,
        );
      }
    }

    const csvText = csv.join("\n");
    await downloadText(
      "clip-notes_notes.csv",
      csvText,
      "text/csv;charset=utf-8",
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Download interrupted.") {
      throw error;
    }
    throw new Error("Error downloading csv notes", { cause: error });
  }
}

function escapeText(text: string) {
  return `"${text.replaceAll('"', '""')}"`;
}

async function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const downloadId = await chrome.downloads.download({
    url,
    filename,
    saveAs: false,
  });

  // awaiting promise because we want side effects to run
  // on success or error not in-progress
  // event listener complicates watch, thus the await.
  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      chrome.downloads.onChanged.removeListener(onChanged);
      return ok ? resolve() : reject(new Error("Download interrupted."));
    };

    const onChanged = (downloadDelta: chrome.downloads.DownloadDelta) => {
      if (settled || downloadDelta.id !== downloadId) return;
      if (downloadDelta.state?.current === "complete") finish(true);
      if (downloadDelta.state?.current === "interrupted") finish(false);
    };

    chrome.downloads.onChanged.addListener(onChanged);

    chrome.downloads
      .search({ id: downloadId })
      .then(([item]) => {
        if (!item) return;
        if (item.state === "complete") finish(true);
        if (item.state === "interrupted") finish(false);
      })
      .catch(() => {});
  });
}
