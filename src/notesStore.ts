import * as vscode from 'vscode';
import { Note, FileNotes, NotesData } from './types';

/**
 * NotesStore is the single source of truth for all notes.
 *
 * v1 persistence: context.workspaceState (a simple key/value store scoped to
 * the workspace). The public API here is intentionally storage-agnostic so a
 * future version can swap the backing store for a JSON sidecar file
 * (e.g. .vscode-notes/notes.json) without changing decorations/hover code.
 */
export class NotesStore {
	private static readonly STORAGE_KEY = 'inlineNotes.data';

	/** In-memory cache of all notes. Mirrors what is persisted. */
	private data: NotesData;

	constructor(private readonly context: vscode.ExtensionContext) {
		// Load persisted notes on startup, defaulting to an empty map.
		this.data = context.workspaceState.get<NotesData>(NotesStore.STORAGE_KEY, {});
	}

	/**
	 * Build the storage key for a document. Using the URI string keeps notes
	 * tied to a specific file. (Later this could be made workspace-relative for
	 * portability across machines.)
	 */
	static keyForUri(uri: vscode.Uri): string {
		return uri.toString();
	}

	/** Return all notes for a given document as a list. */
	getNotesForUri(uri: vscode.Uri): Note[] {
		const fileNotes = this.data[NotesStore.keyForUri(uri)];
		return fileNotes ? Object.values(fileNotes) : [];
	}

	/** Return a single note by id for a given document, or undefined. */
	getNote(uri: vscode.Uri, id: string): Note | undefined {
		return this.data[NotesStore.keyForUri(uri)]?.[id];
	}

	/** Create and persist a new note. Returns the created note. */
	async addNote(uri: vscode.Uri, line: number, anchorText: string, body: string): Promise<Note> {
		const now = Date.now();
		const note: Note = {
			id: this.generateId(),
			line,
			anchorText,
			body,
			createdAt: now,
			updatedAt: now,
		};

		const key = NotesStore.keyForUri(uri);
		const fileNotes: FileNotes = this.data[key] ?? {};
		fileNotes[note.id] = note;
		this.data[key] = fileNotes;

		await this.persist();
		return note;
	}

	/** Update the body of an existing note. Returns the updated note (or undefined). */
	async updateNote(uri: vscode.Uri, id: string, body: string): Promise<Note | undefined> {
		const note = this.getNote(uri, id);
		if (!note) {
			return undefined;
		}
		note.body = body;
		note.updatedAt = Date.now();
		await this.persist();
		return note;
	}

	/**
	 * Update the anchor (line + snippet) of an existing note. Used by the
	 * live-update logic when a note re-anchors to a new line after edits.
	 */
	async setAnchor(uri: vscode.Uri, id: string, line: number, anchorText: string): Promise<void> {
		const note = this.getNote(uri, id);
		if (!note) {
			return;
		}
		note.line = line;
		note.anchorText = anchorText;
		await this.persist();
	}

	/** Delete a note by id. Returns true if something was removed. */
	async deleteNote(uri: vscode.Uri, id: string): Promise<boolean> {
		const key = NotesStore.keyForUri(uri);
		const fileNotes = this.data[key];
		if (!fileNotes || !fileNotes[id]) {
			return false;
		}
		delete fileNotes[id];
		// Clean up empty file entries so the store doesn't accumulate junk.
		if (Object.keys(fileNotes).length === 0) {
			delete this.data[key];
		}
		await this.persist();
		return true;
	}

	/** Write the in-memory cache back to persistent storage. */
	private async persist(): Promise<void> {
		await this.context.workspaceState.update(NotesStore.STORAGE_KEY, this.data);
	}

	/** Simple unique id generator (good enough for local notes). */
	private generateId(): string {
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}
}
