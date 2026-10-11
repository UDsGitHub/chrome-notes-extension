import type { Note } from "./types.js";
import { normalizeTags } from "./utils.js";

const CSV_HEADER = "id,title,content,createdAt,updatedAt,order,pinned,tags";
const CSV_HEADER_WITH_PINNED = "id,title,content,createdAt,updatedAt,order,pinned";
const CSV_HEADER_WITH_ORDER = "id,title,content,createdAt,updatedAt,order";
const CSV_HEADER_LEGACY = "id,title,content,createdAt,updatedAt";

export type ImportFormat = "json" | "csv";

export type ParseNotesOptions =
  | { filename: string; format?: never }
  | { format: ImportFormat; filename?: never };

export function parseNotes(text: string, options: ParseNotesOptions): Note[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Nothing to import.");
  }

  const format = resolveFormat(options);
  const notes =
    format === "json" ? parseJSONNotes(trimmed) : parseCSVNotes(trimmed);
  assertUniqueIds(notes);
  return notes;
}

function resolveFormat(options: ParseNotesOptions): ImportFormat {
  if ("filename" in options && options.filename) {
    const lower = options.filename.toLowerCase();
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".csv")) return "csv";
    throw new Error("File must be .json or .csv.");
  }

  if ("format" in options && options.format) {
    return options.format;
  }

  throw new Error("Choose JSON or CSV.");
}

function parseJSONNotes(text: string): Note[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON.");
  }

  if (!Array.isArray(data)) {
    throw new Error("JSON must be an array of notes.");
  }

  return data.map((item, index) => validateNote(item, index + 1));
}

function parseCSVNotes(text: string): Note[] {
  const rows = parseCSV(text);
  if (rows.length === 0) {
    throw new Error("CSV is empty.");
  }

  const header = rows[0]!.join(",");
  const hasTags = header === CSV_HEADER;
  const hasPinned = hasTags || header === CSV_HEADER_WITH_PINNED;
  const hasOrder = hasPinned || header === CSV_HEADER_WITH_ORDER;
  if (!hasOrder && header !== CSV_HEADER_LEGACY) {
    throw new Error(`CSV header must be ${CSV_HEADER}.`);
  }

  if (rows.length === 1) {
    return [];
  }

  const expectedColumns = hasTags ? 8 : hasPinned ? 7 : hasOrder ? 6 : 5;

  return rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    if (row.length !== expectedColumns) {
      throw new Error(`Row ${rowNumber} has the wrong number of columns.`);
    }

    const [
      id,
      title,
      content,
      createdAt,
      updatedAtRaw,
      orderRaw,
      pinnedRaw,
      tagsRaw,
    ] = row as [
      string,
      string,
      string,
      string,
      string,
      string?,
      string?,
      string?,
    ];

    return validateNote(
      {
        id,
        title,
        content,
        createdAt,
        updatedAt: updatedAtRaw === "" ? undefined : updatedAtRaw,
        ...(hasOrder && orderRaw !== ""
          ? { order: Number(orderRaw) }
          : {}),
        ...(hasPinned ? { pinned: pinnedRaw } : {}),
        ...(hasTags ? { tags: tagsRaw ?? "" } : {}),
      },
      rowNumber,
    );
  });
}

function validateNote(value: unknown, rowNumber: number): Note {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Row ${rowNumber} is not a note object.`);
  }

  const record = value as Record<string, unknown>;
  const id = requireNonEmptyString(record.id, "id", rowNumber);
  const title = requireNonEmptyString(record.title, "title", rowNumber);
  const content = requireNonEmptyString(record.content, "content", rowNumber);
  const createdAt = requireDateString(record.createdAt, "createdAt", rowNumber);

  const note: Note = {
    id,
    title,
    content,
    createdAt,
    pinned: false,
    tags: [],
  };

  if ("updatedAt" in record && record.updatedAt != null && record.updatedAt !== "") {
    if (typeof record.updatedAt !== "string") {
      throw new Error(`Row ${rowNumber} has an invalid updatedAt.`);
    }
    note.updatedAt = requireDateString(
      record.updatedAt,
      "updatedAt",
      rowNumber,
    );
  }

  if ("order" in record && record.order != null && record.order !== "") {
    const order =
      typeof record.order === "number" ? record.order : Number(record.order);
    if (!Number.isFinite(order)) {
      throw new Error(`Row ${rowNumber} has an invalid order.`);
    }
    note.order = order;
  }

  if ("pinned" in record && record.pinned != null && record.pinned !== "") {
    note.pinned = parsePinned(record.pinned, rowNumber);
  }

  if ("tags" in record && record.tags != null && record.tags !== "") {
    if (Array.isArray(record.tags)) {
      const invalid = record.tags.some((tag) => typeof tag !== "string");
      if (invalid) {
        throw new Error(`Row ${rowNumber} has an invalid tags value.`);
      }
      note.tags = normalizeTags(record.tags);
    } else if (typeof record.tags === "string") {
      note.tags = normalizeTags(record.tags);
    } else {
      throw new Error(`Row ${rowNumber} has an invalid tags value.`);
    }
  }

  return note;
}

function parsePinned(value: unknown, rowNumber: number): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  throw new Error(`Row ${rowNumber} has an invalid pinned value.`);
}

function requireNonEmptyString(
  value: unknown,
  field: string,
  rowNumber: number,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Row ${rowNumber} is missing a ${field}.`);
  }
  return value;
}

function requireDateString(
  value: unknown,
  field: string,
  rowNumber: number,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Row ${rowNumber} is missing a ${field}.`);
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Row ${rowNumber} has an invalid ${field}.`);
  }
  return value;
}

function assertUniqueIds(notes: Note[]) {
  const seen = new Set<string>();
  for (const note of notes) {
    if (seen.has(note.id)) {
      throw new Error(`Duplicate id in import: ${note.id}.`);
    }
    seen.add(note.id);
  }
}

/** RFC 4180-style CSV parser for quoted fields and escaped quotes. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      row = [];
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("CSV has an unclosed quote.");
  }

  row.push(field);
  if (row.length > 1 || row[0] !== "") {
    rows.push(row);
  }

  return rows;
}
