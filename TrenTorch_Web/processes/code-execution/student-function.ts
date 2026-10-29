// The one place a student's JavaScript is turned into something that can run.
//
// Running the code a student typed is what the JavaScript option of the IDE is for, so this is deliberate
// rather than an injection: it happens inside a dedicated Web Worker in the student's own browser, with no
// access to the page, and nothing from anyone else ever reaches it. CodeQL cannot tell that apart from a
// vulnerability, so the call lives here, alone, and only this file is left out of its analysis
// (.github/codeql/codeql-config.yml). Everything else, including the files that call this, is still scanned.

/** Builds a function with the given parameter names whose body is `body`. Throws on a syntax error. */
export function compileStudentCode(
	parameters: string[],
	body: string
): (...args: unknown[]) => unknown {
	return new Function(...parameters, body) as (...args: unknown[]) => unknown;
}
