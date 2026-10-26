import type { QuestionContent } from '$data/curriculum/types';
import { isSqlQuestion } from '../ide-content/sql-question';

export type Language = 'python' | 'sql' | 'javascript' | 'cpp';

// DSA questions let the student pick their language in the IDE; every other
// question kind is auto-detected the way it always was.
export const DSA_LANGUAGES: Language[] = ['python', 'javascript', 'cpp'];

export function detectLanguage(content: QuestionContent): Language {
	return isSqlQuestion(content.metadata.tags, content.id) ? 'sql' : 'python';
}

export function isLanguageSelectable(content: QuestionContent): boolean {
	return content.metadata.kind === 'dsa';
}
