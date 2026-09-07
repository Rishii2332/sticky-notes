import * as vscode from 'vscode';
import { NotesStore } from './notesStore';
import { resolveNoteLine } from './anchor';

/**
 * DecorationManager owns the single TextEditorDecorationType used to render a
 * gutter icon next to any line that has a note. It knows how to (re)apply
 * decorations to an editor by reading the current notes from the store.
 */
export class DecorationManager {
	private readonly decorationType: vscode.TextEditorDecorationType;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly store: NotesStore,
	) {
		// A gutter icon shown in the left margin of noted lines.
		this.decorationType = vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.joinPath(context.extensionUri, 'media', 'note.svg'),
			gutterIconSize: 'contain',
			// Also add a subtle overview-ruler mark so notes are visible in the scrollbar.
			overviewRulerColor: new vscode.ThemeColor('editorInfo.foreground'),
			overviewRulerLane: vscode.OverviewRulerLane.Left,
		});
		context.subscriptions.push(this.decorationType);
	}

	/**
	 * Refresh decorations for a specific editor. Reads that file's notes,
	 * resolves each note's current line (anchor resilience), and applies one
	 * decoration per noted line with a hover-friendly message.
	 */
	refresh(editor: vscode.TextEditor | undefined): void {
		if (!editor) {
			return;
		}

		const notes = this.store.getNotesForUri(editor.document.uri);
		const decorations: vscode.DecorationOptions[] = notes.map((note) => {
			const line = resolveNoteLine(editor.document, note);
			const range = new vscode.Range(line, 0, line, 0);
			return {
				range,
				// A short hover shown by the decoration itself. The richer,
				// interactive hover (with edit/delete links) comes from the
				// HoverProvider, but this is a nice lightweight preview.
				hoverMessage: new vscode.MarkdownString(`📝 ${note.body}`),
			};
		});

		editor.setDecorations(this.decorationType, decorations);
	}
}
