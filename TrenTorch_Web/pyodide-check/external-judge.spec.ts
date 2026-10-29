import { describe, it, expect, beforeAll } from 'vitest';
import { curriculum as generated } from 'virtual:curriculum/bundle';
import { buildTestHarness } from '$processes/ide-content/build-test-harness';
import { sanitizeStudentCode } from '$processes/code-execution/sanitize-student-code';
import type { GeneratedQuestion } from '$processes/ide-content/curriculum-index';
import type {
	ExternalJudgement,
	ExternalOutputs,
	ExternalPlan
} from '$processes/code-execution/external-protocol';
import { startPyodide, prepare, judge, referenceAnswers } from './external-kit';

// What the judge says when another language answers wrongly, slowly, not at all, or cannot be run: the
// same messages a Python submission gets, and nothing a student could pass by accident. Mutates the
// reference answers (external-seam.spec.ts shows they pass) and checks each outcome.

const all = generated.roots.flatMap((root) =>
	root.sections.flatMap((section) => section.tracks.flatMap((track) => track.questions))
) as GeneratedQuestion[];
const byId = (id: string) => all.find((q) => q.id === id)!;

interface Setup {
	harness: string;
	plan: ExternalPlan;
	answers: ExternalOutputs;
}

async function setup(id: string): Promise<Setup> {
	const question = byId(id);
	const harness = buildTestHarness(question);
	const plan = await prepare(harness);
	const answers = JSON.parse(
		await referenceAnswers(harness, sanitizeStudentCode(question.oracleSolutionCode), plan)
	) as ExternalOutputs;
	return { harness, plan, answers };
}

const result = (j: ExternalJudgement, name: RegExp) => j.results.find((r) => name.test(r.name))!;

describe('judging another language: what goes wrong', () => {
	let s: Setup;
	beforeAll(async () => {
		await startPyodide();
		s = await setup('sheet-two-sum-first-pair');
	}, 180_000);
	const outputs = (change: (o: ExternalOutputs) => void): ExternalOutputs => {
		const copy = structuredClone(s.answers);
		change(copy);
		return copy;
	};

	it('passes the reference answers, and says nothing about reads for a question without a limit', async () => {
		const j = await judge(s.harness, s.answers);
		expect(j.results.every((r) => r.passed && !r.skipped)).toBe(true);
		expect(j.notes).toEqual([]);
	});

	it('a wrong answer on an example shows input, expected and got; on a hidden case it does not', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				o['example_1:0'] = { out: [9, 9], ms: 1, reads: null };
				o['case_3:0'] = { out: [9, 9], ms: 1, reads: null };
			})
		);
		const example = result(j, /example_1/);
		expect(example.passed).toBe(false);
		expect(example.error).toMatch(/Wrong answer\.\nInput: .*\nExpected: .*\nGot: \[9, 9\]/);
		const hidden = result(j, /case_3/);
		expect(hidden.error).toMatch(/Wrong answer on a hidden test case\.$/);
		expect(hidden.error).not.toMatch(/Expected/);
	});

	it('a wrong answer inside a random batch names which one', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				o['random_batch:7'] = { out: [123456, 7], ms: 1, reads: null };
			})
		);
		expect(result(j, /random_batch/).error).toMatch(/Wrong answer on random case 8 of 300/);
	});

	it('a normal call over its limit is a time limit failure with the numbers', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				(o['case_1:0'] as { ms: number }).ms = 99999;
			})
		);
		expect(result(j, /case_1/).error).toMatch(
			/Time limit exceeded: took 99999 ms, the limit is 1500 ms/
		);
		// The other tests are not affected.
		expect(result(j, /case_2/).passed).toBe(true);
	});

	it('a batch is limited as a whole, not per call', async () => {
		const fast = await judge(s.harness, s.answers);
		expect(result(fast, /random_batch/).passed).toBe(true);
		const slow = await judge(
			s.harness,
			outputs((o) => {
				for (let i = 0; i < 300; i++) (o[`random_batch:${i}`] as { ms: number }).ms = 10;
			})
		);
		expect(result(slow, /random_batch/).error).toMatch(
			/the random cases took 3000 ms, the limit is 1500 ms/
		);
	});

	it('after one slow performance test the rest are skipped, by the judge itself too', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				(o['perf_1:0'] as { ms: number }).ms = 99999;
				// The harness may or may not have skipped the rest; the judge must not need it to.
			})
		);
		expect(result(j, /perf_1/).error).toMatch(/Time limit exceeded/);
		expect(result(j, /perf_2/).error).toMatch(
			/Skipped: an earlier performance test was already too slow/
		);
		expect(result(j, /perf_3/).error).toMatch(
			/Skipped: an earlier performance test was already too slow/
		);
		// A skipped performance test is a failure, not a pass.
		expect(result(j, /perf_2/).passed).toBe(false);
		expect(result(j, /case_1/).passed).toBe(true);
	});

	it('a skip record from the language is a skipped performance test', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				o['perf_2:0'] = { skip: true };
			})
		);
		expect(result(j, /perf_2/).error).toMatch(/Skipped: an earlier performance test/);
		expect(result(j, /perf_2/).passed).toBe(false);
	});

	it('a runtime error is reported for that test only', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				o['case_4:0'] = { error: 'TypeError: boom' };
			})
		);
		expect(result(j, /case_4/).error).toMatch(/Runtime error: TypeError: boom/);
		expect(result(j, /case_5/).passed).toBe(true);
	});

	it('a program that stopped part way: that test is a time limit, the rest were not run', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				for (const k of Object.keys(o)) {
					if (k.startsWith('case_6:') || k.startsWith('case_7:') || k.startsWith('case_8:'))
						delete o[k];
				}
			})
		);
		expect(result(j, /case_6/).error).toMatch(
			/Time limit exceeded: your program did not finish this test/
		);
		expect(result(j, /case_7/).error).toMatch(/Skipped: an earlier test did not finish/);
		expect(result(j, /case_8/).error).toMatch(/Skipped: an earlier test did not finish/);
		expect(result(j, /case_5/).passed).toBe(true);
	});

	it('a fatal error is a runtime error and the tests after it were not run', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				o['case_6:0'] = { error: 'The program crashed.', fatal: true };
				for (const k of Object.keys(o)) {
					if (/^(case_[7-9]|case_10|random_batch|perf_\d):/.test(k)) delete o[k];
				}
			})
		);
		expect(result(j, /case_6/).error).toMatch(/Runtime error: The program crashed/);
		expect(result(j, /case_7/).error).toMatch(/Skipped: an earlier test did not finish/);
		expect(result(j, /perf_1/).error).toMatch(/Skipped/);
	});

	it('a test the language cannot run counts as passed-and-skipped, never as a pass of its own', async () => {
		const j = await judge(
			s.harness,
			outputs((o) => {
				o['case_9:0'] = { unsupported: 'this test uses numbers too big.' };
			})
		);
		const r = result(j, /case_9/);
		expect(r.passed).toBe(true);
		expect(r.skipped).toBe(true);
		expect(r.error).toMatch(/^Skipped: this test uses numbers too big/);
	});

	it('answers sent as JSON text keep integers beyond 2^53 exact; a rounded number does not pass', async () => {
		const question = byId('sheet-nth-fibonacci');
		const harness = buildTestHarness(question);
		const plan = await prepare(harness);
		const raw = await referenceAnswers(
			harness,
			sanitizeStudentCode(question.oracleSolutionCode),
			plan
		);
		expect(/"out": -?\d{17,}/.test(raw), 'a case with an answer beyond 2^53').toBe(true);
		// What a typed language sends: every long answer as the digits it wrote, as text.
		const asText = JSON.parse(
			raw.replace(/\{"out": (-?\d{17,})/g, '{"outJson": "$1"')
		) as ExternalOutputs;
		const exact = await judge(harness, asText);
		expect(exact.results.filter((r) => !r.passed)).toEqual([]);
		// What would happen if they went through a JavaScript number: those cases fail.
		const rounded = await judge(harness, JSON.parse(raw) as ExternalOutputs);
		expect(rounded.results.filter((r) => !r.passed).length).toBeGreaterThan(0);
	});
});

describe('judging another language: read limits', () => {
	let s: Setup;
	beforeAll(async () => {
		await startPyodide();
		s = await setup('sheet-binary-search-index');
	}, 180_000);

	it('cannot count reads outside JavaScript, says so once, and still checks the answer', async () => {
		const j = await judge(s.harness, s.answers);
		expect(j.results.every((r) => r.passed)).toBe(true);
		expect(j.notes).toHaveLength(1);
		expect(j.notes[0]).toMatch(/cannot count how many values your code reads/);
	});

	it('JavaScript reports its reads, and too many is a failure with the count', async () => {
		const readsKey = Object.keys(s.answers).find((k) => /^reads_/.test(k))!;
		expect(readsKey).toBeTruthy();
		const withReads = structuredClone(s.answers);
		for (const k of Object.keys(withReads)) (withReads[k] as { reads: number | null }).reads = 3;
		const ok = await judge(s.harness, withReads);
		expect(ok.results.every((r) => r.passed)).toBe(true);
		expect(ok.notes).toEqual([]);
		(withReads[readsKey] as { reads: number | null }).reads = 100000;
		const bad = await judge(s.harness, withReads);
		const failing = bad.results.filter((r) => !r.passed);
		expect(failing).toHaveLength(1);
		expect(failing[0].error).toMatch(
			/Right answer, but too many reads: your code read the list 100000 times/
		);
	});
});
