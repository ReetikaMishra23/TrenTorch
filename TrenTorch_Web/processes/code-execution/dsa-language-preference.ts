import { DSA_LANGUAGES, type Language } from './detect-language';

const KEY = 'trentorch_dsa_language';

// The language the student last picked on a DSA question, so the next question opens in it too.
export function loadDsaLanguage(): Language | null {
	if (typeof window === 'undefined') return null;
	try {
		const saved = localStorage.getItem(KEY);
		return DSA_LANGUAGES.find((language) => language === saved) ?? null;
	} catch {
		return null;
	}
}

export function saveDsaLanguage(language: Language): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(KEY, language);
	} catch {
		// Private mode or a full quota: the choice just is not remembered.
	}
}
