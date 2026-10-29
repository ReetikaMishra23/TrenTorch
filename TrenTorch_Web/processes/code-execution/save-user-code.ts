// LocalStorage persistence for student code, keyed generically by whatever
// content id the current /ide/[id] route is showing -- the IDE doesn't know
// or care if that's a question or a module. Solved status itself lives in
// processes/progress-tracking/solved.svelte.ts, the same store the
// Questions page reads, so passing an IDE's hidden tests and manually
// checking a question off on /questions both land in one place.
import { codeStorageKey } from './code-storage-key';
import { stampLocalDraft, queueDraftPush } from './draft-sync.svelte';

export function saveUserCode(contentId: string, code: string, language: string = 'python'): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(codeStorageKey(contentId, language), code);
		// Drafts sync across devices for Python only; the other languages stay on this browser.
		if (language !== 'python') return;
		queueDraftPush(contentId, code, stampLocalDraft(contentId));
	} catch (e) {
		console.error('Failed to save code to localStorage', e);
	}
}
