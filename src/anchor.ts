import * as vscode from 'vscode';
import { Note } from './types';

/**
 * Anchor resilience (v1, deliberately simple).
 *
 * A note remembers the line number it was attached to plus a snippet of that
 * line's text. When we render, we try the stored line first. If that line's
 * text no longer matches the snippet (because lines were added/removed above),
 * we scan nearby lines for the best match and use that instead.
 *
 * This is intentionally NOT over-engineered: no diffing, no AST. Just a
 * best-effort re-locate that handles the common "some lines shifted" case.
 */

/** Normalize a line for comparison: trim and collapse internal whitespace. */
function normalize(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}

/**
 * Resolve the current line for a note within a document.
 *
 * Returns the best-guess 0-based line index. If nothing reasonable is found,
 * falls back to the stored line clamped to the document's bounds.
 */
export function resolveNoteLine(document: vscode.TextDocument, note: Note): number {
	const lineCount = document.lineCount;
	const target = normalize(note.anchorText);

	// Empty anchor text: nothing to match against, just clamp the stored line.
	if (target.length === 0) {
		return Math.min(note.line, Math.max(0, lineCount - 1));
	}

	// Fast path: stored line still matches the snippet.
	if (note.line < lineCount && normalize(document.lineAt(note.line).text) === target) {
		return note.line;
	}

	// Fallback: search outward from the stored line for the nearest exact match.
	// Searching outward (not top-to-bottom) keeps the note near where it was.
	const maxRadius = lineCount;
	for (let radius = 1; radius <= maxRadius; radius++) {
		const up = note.line - radius;
		const down = note.line + radius;

		if (up >= 0 && up < lineCount && normalize(document.lineAt(up).text) === target) {
			return up;
		}
		if (down >= 0 && down < lineCount && normalize(document.lineAt(down).text) === target) {
			return down;
		}
	}

	// No match found: clamp the stored line so we never point out of bounds.
	return Math.min(note.line, Math.max(0, lineCount - 1));
}
