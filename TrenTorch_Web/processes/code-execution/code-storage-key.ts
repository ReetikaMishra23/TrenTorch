export const CODE_KEY_PREFIX = 'trentorch_code_';

// Python keeps the original key (and its cross-device sync); every other DSA language gets its
// own local-only draft, so switching language never overwrites another language's code.
export function codeStorageKey(contentId: string, language: string = 'python'): string {
	return language === 'python'
		? `${CODE_KEY_PREFIX}${contentId}`
		: `${CODE_KEY_PREFIX}${contentId}__${language}`;
}
