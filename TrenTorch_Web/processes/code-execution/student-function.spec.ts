import { describe, expect, it } from 'vitest';
import { compileStudentCode } from './student-function';

describe('compileStudentCode', () => {
	it('builds a function with the given parameter names', () => {
		const add = compileStudentCode(['a', 'b'], 'return a + b;');
		expect(add(2, 3)).toBe(5);
	});

	it('runs in strict mode when the body says so', () => {
		const sloppy = compileStudentCode([], '"use strict"; undeclared = 1;');
		expect(() => sloppy()).toThrow(ReferenceError);
	});

	it('throws a SyntaxError for code that does not parse, without running it', () => {
		expect(() => compileStudentCode([], 'return [;')).toThrow(SyntaxError);
	});
});
