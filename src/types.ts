// Shared types for the Inline Notes extension.

/**
 * A single note attached to a line of code.
 *
 * We store both the line number AND a snippet of the line's text.
 * The line number is the fast path for locating the note. The snippet is a
 * fallback: if lines are inserted/removed above the note, the stored line
 * number may drift, so we can re-locate the note by fuzzy-matching the snippet.
 */
export interface Note {
	/** Stable unique id for the note (used for edit/delete). */
	id: string;
	/** 0-based line number where the note was last anchored. */
	line: number;
	/** A trimmed snippet of the line's text, used to re-anchor if the line moves. */
	anchorText: string;
	/** The note body (Markdown-friendly plain text). */
	body: string;
	/** Creation timestamp (ms since epoch). */
	createdAt: number;
	/** Last update timestamp (ms since epoch). */
	updatedAt: number;
}

/** All notes for a single document, keyed by note id. */
export type FileNotes = Record<string, Note>;

/**
 * The full persisted shape: a map of document key -> that file's notes.
 * The document key is the file's URI string (see NotesStore.keyForUri).
 */
export type NotesData = Record<string, FileNotes>;
