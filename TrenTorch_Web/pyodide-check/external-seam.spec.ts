import { describe, it, expect, beforeAll } from 'vitest';
import { curriculum as generated } from 'virtual:curriculum/bundle';
import { buildTestHarness } from '$processes/ide-content/build-test-harness';
import { sanitizeStudentCode } from '$processes/code-execution/sanitize-student-code';
import type { GeneratedQuestion } from '$processes/ide-content/curriculum-index';
// Checks the half of a non-Python submission that Python does: making every call's inputs and judging the
// answers (external-protocol.ts). The language in the middle is played by the reference solution, run
// directly on each case's inputs, so a question whose plan or judging disagrees with a Python submission
// shows up here for all DSA questions, before any language is involved. Each language's own side (reading
// the inputs, calling the student's function, writing the answer back) is checked in its own spec.

import { startPyodide, prepare, judge, referenceAnswers } from './external-kit';

const questions = (
	generated.roots.flatMap((root) =>
		root.sections.flatMap((section) => section.tracks.flatMap((track) => track.questions))
	) as GeneratedQuestion[]
).filter((q) => q.kind === 'dsa');

const only = process.env.PYODIDE_ONLY?.split(',').filter(Boolean);

describe('judging answers from another language', () => {
	beforeAll(startPyodide, 120_000);

	it('finds the DSA questions', () => {
		expect(questions.length).toBeGreaterThan(300);
	});

	it.each(questions.filter((q) => !only || only.includes(q.id)).map((q) => [q.id, q] as const))(
		'%s: the reference answers pass every test',
		async (_id, question) => {
			const code = sanitizeStudentCode(question.oracleSolutionCode);
			const harness = buildTestHarness(question);
			const plan = await prepare(harness);
			expect(plan.calls.length).toBeGreaterThan(0);
			const answers = await referenceAnswers(harness, code, plan);
			const judged = await judge(harness, answers);
			expect(judged.error).toBeNull();
			const failing = judged.results.filter((r) => !r.passed);
			expect(failing.map((r) => `${r.name}: ${r.error}`)).toEqual([]);
			expect(judged.results.length).toBeGreaterThan(0);
		},
		120_000
	);
});
