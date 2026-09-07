// Inline Notes — attach notes to lines of code without cluttering files.
//
// This file is the composition root: it constructs the store, decoration
// manager, and hover provider, registers commands, and wires up the live
// update events. The actual logic lives in the focused modules imported below.
import * as vscode from 'vscode';
import { NotesStore } from './notesStore';
import { DecorationManager } from './decorations';
import { NoteHoverProvider } from './hoverProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Inline Notes is now active');

	// --- Core services ---
	const store = new NotesStore(context);
	const decorations = new DecorationManager(context, store);

	// Apply decorations to the editor that is active on startup.
	decorations.refresh(vscode.window.activeTextEditor);

	// --- Hover provider (Step 3 + edit/delete links) ---
	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			{ scheme: 'file' },
			new NoteHoverProvider(store),
		),
	);

	// --- Command: Add Note (Step 4) ---
	context.subscriptions.push(
		vscode.commands.registerCommand('inline-notes.addNote', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage('Open a file and place the cursor on a line to add a note.');
				return;
			}

			const body = await vscode.window.showInputBox({
				prompt: 'Note text',
				placeHolder: 'e.g. This handles the retry-with-backoff edge case',
			});
			// User cancelled (Esc) or entered nothing.
			if (!body) {
				return;
			}

			const line = editor.selection.active.line;
			const anchorText = editor.document.lineAt(line).text.trim();

			await store.addNote(editor.document.uri, line, anchorText, body);
			decorations.refresh(editor);
		}),
	);

	// --- Command: Edit Note (Step 7) ---
	// Invoked from the hover popup with [uriString, noteId] arguments.
	context.subscriptions.push(
		vscode.commands.registerCommand('inline-notes.editNote', async (uriString: string, id: string) => {
			const uri = vscode.Uri.parse(uriString);
			const note = store.getNote(uri, id);
			if (!note) {
				vscode.window.showWarningMessage('That note no longer exists.');
				return;
			}

			const body = await vscode.window.showInputBox({
				prompt: 'Edit note text',
				value: note.body,
			});
			if (body === undefined) {
				return; // cancelled
			}

			await store.updateNote(uri, id, body);
			decorations.refresh(editorForUri(uri));
		}),
	);

	// --- Command: Delete Note (Step 7) ---
	context.subscriptions.push(
		vscode.commands.registerCommand('inline-notes.deleteNote', async (uriString: string, id: string) => {
			const uri = vscode.Uri.parse(uriString);
			const removed = await store.deleteNote(uri, id);
			if (removed) {
				decorations.refresh(editorForUri(uri));
				vscode.window.showInformationMessage('Note deleted.');
			}
		}),
	);

	// --- Live updates (Step 6) ---
	// Refresh when the user switches to a different editor.
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => decorations.refresh(editor)),
	);

	// Refresh when the active document is edited so decorations follow the text.
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			const editor = vscode.window.activeTextEditor;
			if (editor && event.document === editor.document) {
				decorations.refresh(editor);
			}
		}),
	);
}

/** Find an open editor showing the given document URI, if any. */
function editorForUri(uri: vscode.Uri): vscode.TextEditor | undefined {
	return vscode.window.visibleTextEditors.find(
		(e) => e.document.uri.toString() === uri.toString(),
	);
}

export function deactivate() {}
