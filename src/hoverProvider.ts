import * as vscode from 'vscode';
import { NotesStore } from './notesStore';
import { resolveNoteLine } from './anchor';

/**
 * NoteHoverProvider shows a Markdown popup when the user hovers over a line
 * that has a note. The popup includes the note body plus clickable Edit and
 * Delete links (implemented as command URIs).
 */
export class NoteHoverProvider implements vscode.HoverProvider {
	constructor(private readonly store: NotesStore) {}

	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.ProviderResult<vscode.Hover> {
		const notes = this.store.getNotesForUri(document.uri);
		if (notes.length === 0) {
			return undefined;
		}

		// Find a note whose (resolved) line matches the hovered line.
		const hovered = notes.find((note) => resolveNoteLine(document, note) === position.line);
		if (!hovered) {
			return undefined;
		}

		// Build a Markdown popup. isTrusted is required for command: links to work.
		const md = new vscode.MarkdownString(undefined, true);
		md.isTrusted = true;
		md.supportHtml = true;

		md.appendMarkdown(`**📝 Inline Note**\n\n`);
		md.appendMarkdown(`${hovered.body}\n\n`);

		// Command links. Arguments are JSON-encoded and URI-component-escaped.
		const args = encodeURIComponent(JSON.stringify([document.uri.toString(), hovered.id]));
		md.appendMarkdown(
			`[Edit](command:inline-notes.editNote?${args}) | ` +
			`[Delete](command:inline-notes.deleteNote?${args})`,
		);

		return new vscode.Hover(md);
	}
}
