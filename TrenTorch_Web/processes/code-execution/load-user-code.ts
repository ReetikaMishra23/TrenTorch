import { codeStorageKey } from './code-storage-key';

export function loadUserCode(
	contentId: string,
	defaultCode: string,
	language: string = 'python'
): string {
	if (typeof window === 'undefined') return defaultCode;
	try {
		const saved = localStorage.getItem(codeStorageKey(contentId, language));
		return saved !== null ? saved : defaultCode;
	} catch (e) {
		console.error('Failed to load code from localStorage', e);
		return defaultCode;
	}
}
