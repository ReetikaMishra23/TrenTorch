import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalJudgement, ExternalPlan, ExternalRecord } from './external-protocol';
import type { ExternalRunner } from './external-tests';

// The orchestration of a non-Python submission with Python and the language both replaced by fakes: when a
// program is stopped, what a crash or a build error becomes, and what counts as solved.

const prepared = vi.fn();
const judged = vi.fn();
vi.mock('./pyodide-service', () => ({
	pyodideService: {
		prepareExternal: (...a: unknown[]) => prepared(...a),
		judgeExternal: (...a: unknown[]) => judged(...a)
	}
}));

const { runExternalTests, runExternalCustom, callDeadlineMs } = await import('./external-tests');

const plan = (n = 3, limitMs = 1000): ExternalPlan => ({
	function: { name: 'two_sum', params: [{ name: 'a', type: 'int' }], returns: 'int' },
	compare: 'exact',
	calls: Array.from({ length: n }, (_, i) => ({
		key: `c${i}:0`,
		case: `c${i}`,
		index: 0,
		args: [i],
		limitMs,
		perf: false,
		reads: false,
		batch: false
	}))
});

const judgement = (
	names: string[],
	extra: Partial<ExternalJudgement['results'][number]>[] = []
): ExternalJudgement => ({
	results: names.map((name, i) => ({ name, passed: true, error: null, ...extra[i] })),
	notes: [],
	error: null
});

type Run = ExternalRunner['run'];
function fakeRunner(run: Run, language = 'javascript'): ExternalRunner & { stopped: number } {
	const r = {
		language,
		stopped: 0,
		printed: () => 'printed so far',
		stop() {
			r.stopped++;
		},
		run
	};
	return r;
}

const base = { code: 'x', harness: 'h', contentId: 'q', onProgress: () => {} };

beforeEach(() => {
	vi.useFakeTimers();
	prepared.mockReset();
	judged.mockReset();
	prepared.mockResolvedValue({ plan: plan(), error: null });
	judged.mockImplementation(async (_h: string, outputs: Record<string, ExternalRecord>) =>
		judgement(Object.keys(outputs))
	);
});
afterEach(() => vi.useRealTimers());

describe('callDeadlineMs', () => {
	it('is four times the limit, and never less than three seconds more than it', () => {
		expect(callDeadlineMs(10_000)).toBe(40_000);
		expect(callDeadlineMs(1500)).toBe(6000);
		expect(callDeadlineMs(100)).toBe(3100);
	});
});

describe('runExternalTests', () => {
	it('hands every record to Python to judge and reports its verdicts as a submission', async () => {
		const runner = fakeRunner(async (_c, p, hooks) => {
			hooks.started();
			for (const c of p.calls) hooks.record(c.key, { out: 1, ms: 1, reads: null });
			return { stdout: 'hello' };
		});
		const result = await runExternalTests({ ...base, runner });
		expect(judged.mock.calls[0][1]).toEqual({
			'c0:0': { out: 1, ms: 1, reads: null },
			'c1:0': { out: 1, ms: 1, reads: null },
			'c2:0': { out: 1, ms: 1, reads: null }
		});
		expect(result).toMatchObject({
			totalTests: 3,
			passedTests: 3,
			failedTests: 0,
			allPassed: true,
			isSample: false
		});
		expect(result.rawOutput).toBe('hello');
	});

	it('asks for the first few tests only on Run, and says so', async () => {
		const runner = fakeRunner(async () => ({ stdout: '' }));
		const result = await runExternalTests({ ...base, runner, sampleLimit: 2 });
		expect(prepared.mock.calls[0][2]).toBe(2);
		expect(judged.mock.calls[0][2]).toBe(2);
		expect(result.isSample).toBe(true);
	});

	it('tells Python the largest integer the language holds', async () => {
		await runExternalTests({
			...base,
			runner: fakeRunner(async () => ({ stdout: '' }), 'javascript')
		});
		expect(prepared.mock.calls[0][1]).toBe(String(Number.MAX_SAFE_INTEGER));
		await runExternalTests({ ...base, runner: fakeRunner(async () => ({ stdout: '' }), 'cpp') });
		expect(prepared.mock.calls[1][1]).toBe('9223372036854775807');
	});

	it('stops a program stuck on a call after four times its limit, keeping the earlier answers', async () => {
		const runner = fakeRunner(
			(_c, p, hooks) =>
				new Promise(() => {
					hooks.started();
					hooks.record(p.calls[0].key, { out: 1, ms: 1, reads: null });
					// then never answers
				})
		);
		const run = runExternalTests({ ...base, runner });
		await vi.advanceTimersByTimeAsync(callDeadlineMs(1000) - 1);
		expect(runner.stopped).toBe(0);
		await vi.advanceTimersByTimeAsync(2);
		const result = await run;
		expect(runner.stopped).toBe(1);
		expect(Object.keys(judged.mock.calls[0][1])).toEqual(['c0:0']);
		expect(result.rawOutput).toContain('printed so far');
	});

	it('does not start the clock until the program says it is built', async () => {
		let release!: () => void;
		const runner = fakeRunner(
			(_c, p, hooks) =>
				new Promise((resolve) => {
					release = () => {
						hooks.started();
						for (const c of p.calls) hooks.record(c.key, { out: 1, ms: 1, reads: null });
						resolve({ stdout: '' });
					};
				})
		);
		const run = runExternalTests({ ...base, runner });
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(runner.stopped).toBe(0);
		release();
		expect((await run).allPassed).toBe(true);
	});

	it('restarts the clock after each answer', async () => {
		const runner = fakeRunner(
			(_c, p, hooks) =>
				new Promise((resolve) => {
					hooks.started();
					let i = 0;
					const next = () => {
						hooks.record(p.calls[i].key, { out: 1, ms: 1, reads: null });
						if (++i < p.calls.length) setTimeout(next, callDeadlineMs(1000) - 100);
						else resolve({ stdout: '' });
					};
					setTimeout(next, callDeadlineMs(1000) - 100);
				})
		);
		const run = runExternalTests({ ...base, runner });
		await vi.advanceTimersByTimeAsync(callDeadlineMs(1000) * 3);
		expect((await run).allPassed).toBe(true);
		expect(runner.stopped).toBe(0);
	});

	it('a crash is a fatal runtime error on the call it died on, friendlier than the raw trap', async () => {
		const runner = fakeRunner(async (_c, p, hooks) => {
			hooks.started();
			hooks.record(p.calls[0].key, { out: 1, ms: 1, reads: null });
			return { stdout: '', crash: 'RuntimeError: unreachable' };
		});
		await runExternalTests({ ...base, runner });
		const outputs = judged.mock.calls[0][1];
		expect(outputs['c1:0']).toEqual({
			error: 'The program crashed (an abort, a failed assert, or an invalid operation).',
			fatal: true
		});
		expect(outputs['c2:0']).toBeUndefined();
	});

	it('a build error is reported before any test, and nothing is judged', async () => {
		const runner = fakeRunner(async () => {
			throw new Error('main.cpp:1:1: error: expected unqualified-id');
		});
		const result = await runExternalTests({ ...base, runner });
		expect(judged).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			totalTests: 0,
			allPassed: false,
			error: 'main.cpp:1:1: error: expected unqualified-id'
		});
	});

	it('Python failing to prepare the tests is reported, not thrown', async () => {
		prepared.mockResolvedValue({ plan: null, error: 'Traceback: no tests' });
		const run = vi.fn();
		const result = await runExternalTests({ ...base, runner: fakeRunner(run) });
		expect(run).not.toHaveBeenCalled();
		expect(result.error).toBe('Traceback: no tests');
	});

	it('a submission where only skipped tests passed is not solved', async () => {
		judged.mockResolvedValue(
			judgement(
				['a', 'b'],
				[
					{ skipped: true, error: 'Skipped: too big' },
					{ skipped: true, error: 'Skipped: too big' }
				]
			)
		);
		const result = await runExternalTests({
			...base,
			runner: fakeRunner(async () => ({ stdout: '' }))
		});
		expect(result).toMatchObject({ passedTests: 2, allPassed: false });
		expect(result.results.every((r) => r.skipped)).toBe(true);
	});

	it('skipped tests alongside real passes still solve it', async () => {
		judged.mockResolvedValue(
			judgement(['a', 'b'], [{}, { skipped: true, error: 'Skipped: too big' }])
		);
		const result = await runExternalTests({
			...base,
			runner: fakeRunner(async () => ({ stdout: '' }))
		});
		expect(result.allPassed).toBe(true);
	});

	it('one failing test is not solved, and notes are shown with the output', async () => {
		judged.mockResolvedValue({
			results: [
				{ name: 'a', passed: true, error: null },
				{ name: 'b', passed: false, error: 'Wrong answer.' }
			],
			notes: ['Reads cannot be counted here.'],
			error: null
		});
		const result = await runExternalTests({
			...base,
			runner: fakeRunner(async () => ({ stdout: 'out' }))
		});
		expect(result).toMatchObject({ passedTests: 1, failedTests: 1, allPassed: false });
		expect(result.rawOutput).toBe('out\n\nNote: Reads cannot be counted here.');
	});

	it('Python failing to judge is reported as the error', async () => {
		judged.mockResolvedValue({ results: [], notes: [], error: 'Traceback boom' });
		const result = await runExternalTests({
			...base,
			runner: fakeRunner(async () => ({ stdout: '' }))
		});
		expect(result.error).toBe('Traceback boom');
		expect(result.allPassed).toBe(false);
	});
});

describe('runExternalCustom', () => {
	const custom = (runner: ExternalRunner, args: string, expected = '', name = 'two_sum') =>
		runExternalCustom({
			runner,
			code: 'x',
			harness: 'h',
			functionName: name,
			argumentsJson: args,
			expectedJson: expected,
			onProgress: () => {}
		});
	const answering = (record: ExternalRecord) =>
		fakeRunner(async (_c, p, hooks) => {
			hooks.started();
			hooks.record(p.calls[0].key, record);
			return { stdout: 'student says hi' };
		});

	it('shows what was returned and whether it matched', async () => {
		const ok = await custom(answering({ out: [0, 4], ms: 1, reads: null }), '[3]', '[0, 4]');
		expect(ok).toMatchObject({ success: true });
		expect(ok.output).toBe('student says hi\nReturned: [0,4]\nExpected result matched.');
		const bad = await custom(answering({ out: [0, 4], ms: 1, reads: null }), '[3]', '[1, 1]');
		expect(bad).toMatchObject({ success: false, error: 'Expected [1,1], got [0,4].' });
	});

	it('numbers match within 1e-5, like the Python custom run', async () => {
		const r = await custom(
			answering({ out: 0.30000000000000004, ms: 1, reads: null }),
			'[3]',
			'0.3'
		);
		expect(r.success).toBe(true);
	});

	it('reads an answer sent as JSON text', async () => {
		const r = await custom(
			answering({ outJson: '9223372036854775807', ms: 1, reads: null }),
			'[3]',
			'9223372036854775807'
		);
		expect(r.output).toContain('Returned: 9223372036854775807');
		expect(r.success).toBe(true);
	});

	it('accepts the function under either spelling, and refuses another', async () => {
		const runner = answering({ out: 1, ms: 1, reads: null });
		prepared.mockResolvedValue({ plan: plan(), error: null });
		expect((await custom(runner, '[3]', '', 'two_sum')).success).toBe(true);
		expect((await custom(runner, '[3]', '', 'twoSum')).success).toBe(true);
		const other = await custom(runner, '[3]', '', 'helper');
		expect(other.success).toBe(false);
		expect(other.error).toMatch(/only twoSum can be run here/);
	});

	it('checks the arguments before running anything', async () => {
		const run = vi.fn();
		const runner = fakeRunner(run);
		expect((await custom(runner, '[3', '')).error).toMatch(/JSON array/);
		expect((await custom(runner, '{"a":1}', '')).error).toMatch(/JSON array/);
		expect((await custom(runner, '[1, 2]', '')).error).toMatch(
			/takes 1 argument \(a\) but you gave 2/
		);
		expect((await custom(runner, '[1]', '{bad')).error).toMatch(/expected result must be JSON/);
		expect(run).not.toHaveBeenCalled();
	});

	it('reports a runtime error, a time out, a skip and a build error', async () => {
		expect((await custom(answering({ error: 'boom' }), '[1]')).error).toBe('Runtime error: boom');
		expect((await custom(answering({ unsupported: 'too big' }), '[1]')).error).toBe(
			'Skipped: too big'
		);
		const build = fakeRunner(async () => {
			throw new Error('error: expected ;');
		});
		expect((await custom(build, '[1]')).error).toBe('error: expected ;');
		const stuck = fakeRunner((_c, _p, hooks) => new Promise(() => hooks.started()));
		const run = custom(stuck, '[1]');
		await vi.advanceTimersByTimeAsync(callDeadlineMs(10_000) + 1);
		const result = await run;
		expect(result.error).toMatch(/Time limit exceeded/);
		expect(stuck.stopped).toBe(1);
	});

	it('gives a linked-list parameter as a plain list of values', async () => {
		prepared.mockResolvedValue({
			plan: {
				...plan(),
				function: { name: 'f', params: [{ name: 'head', type: 'ListNode' }], returns: 'ListNode' }
			},
			error: null
		});
		let sent: unknown;
		const runner = fakeRunner(async (_c, p, hooks) => {
			sent = p.calls[0].args;
			hooks.started();
			hooks.record(p.calls[0].key, { out: [3, 2, 1], ms: 1, reads: null });
			return { stdout: '' };
		});
		await custom(runner, '[[1,2,3]]', '', 'f');
		expect(sent).toEqual([{ values: [1, 2, 3], cycle: -1, join: null }]);
	});
});
