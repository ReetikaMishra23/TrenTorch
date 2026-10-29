import { codeStorageKey } from './code-storage-key';
import { forgetLocalDraftStamp, removeRemoteDraft } from './draft-sync.svelte';

// `language` resets just that language's draft; leave it out to reset every language (Re-attempt).
export function resetUserCode(contentId: string, language?: string): void {
	if (typeof window === 'undefined') return;
	try {
		if (language !== undefined && language !== 'python') {
			localStorage.removeItem(codeStorageKey(contentId, language));
			return;
		}
		if (language === undefined) {
			for (const other of ['javascript', 'cpp', 'java', 'go', 'rust']) {
				localStorage.removeItem(codeStorageKey(contentId, other));
			}
		}
		localStorage.removeItem(codeStorageKey(contentId));
		forgetLocalDraftStamp(contentId);
		removeRemoteDraft(contentId);
	} catch (e) {
		console.error('Failed to reset code in localStorage', e);
	}
}
