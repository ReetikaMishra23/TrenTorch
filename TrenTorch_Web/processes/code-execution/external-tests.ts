import type { ExecutionResult, SingleTestResult, SubmissionResult } from '$data/curriculum/types';
import { pyodideService } from './pyodide-service';
import type { ExternalOutputs, ExternalPlan, ExternalRecord } from './external-protocol';
import { MAX_INT } from './external-protocol';
import { friendlyCrash } from './external-codec';
import { ident, type StarterLanguage } from '../ide-content/build-language-starters';

// Runs a DSA submission in a language other than Python (see external-protocol.ts for the three steps).
// The language is a small adapter, so every language is judged by exactly the same code.

/** What a language has to offer. `run` resolves when its program has answered every call or has stopped. */
export interface ExternalRunner {
	language: string;
	/**
	 * Compile and run the student's code on the plan's calls, reporting each record as it is known. Rejects with
	 * an Error whose message is the compile error when the code does not build. `stdout` is what the student printed.
	 */
	run(
		source: string,
		plan: ExternalPlan,
		hooks: {
			/** A call has been answered. */
			record: (key: string, record: ExternalRecord) => void;
			/** What the runner is doing while it loads and builds, for the console. */
			progress: (message: string) => void;
			/** The program is built and about to make its first call: from here the deadlines count. */
			started: () => void;
		}
	): Promise<{ stdout: string; crash?: string }>;
	/** Stop the program now (the worker is terminated); the records already reported are kept. */
	stop(): void;
	/** Output the student's program has printed so far, shown if it has to be stopped. */
	printed(): string;
}

export interface ExternalRunOptions {
	runner: ExternalRunner;
	code: string;
	harness: string;
	contentId: string;
	sampleLimit?: number;
	onProgress: (message: string) => void;
}

// Longest a single call may run before the program is stopped: the case's own limit, several times over,
// because the limit is for a fast machine and this is a browser tab, plus a floor for slow starts.
export const callDeadlineMs = (limitMs: number) => Math.max(limitMs * 4, limitMs + 3000);

const failedBeforeTests = (
	contentId: string,
	isSample: boolean,
	error: string,
	rawOutput = ''
): SubmissionResult => ({
	contentId,
	totalTests: 0,
	passedTests: 0,
	failedTests: 0,
	allPassed: false,
	totalDurationMs: 0,
	results: [],
	rawOutput,
	error,
	isSample
});

interface Execution {
	outputs: ExternalOutputs;
	stdout: string;
	/** The build error when the code does not compile. */
	compileError: string | null;
	timedOut: boolean;
}

/** Step 2: let the language answer the plan's calls, stopping the program if one call takes far too long. */
async function execute(
	runner: ExternalRunner,
	code: string,
	plan: ExternalPlan,
	onProgress: (message: string) => void
): Promise<Execution> {
	const outputs: ExternalOutputs = {};
	let next = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let timedOut = false;
	let compileError: string | null = null;
	let crash: string | null = null;
	let stdout = '';
	let stop: () => void = () => {};
	// The deadline is for the call the program is on; it restarts every time an answer arrives.
	const arm = () => {
		clearTimeout(timer);
		while (next < plan.calls.length && plan.calls[next].key in outputs) next++;
		const call = plan.calls[next];
		if (!call) return;
		timer = setTimeout(() => {
			timedOut = true;
			stop();
		}, callDeadlineMs(call.limitMs));
	};
	await new Promise<void>((resolve) => {
		stop = () => {
			runner.stop();
			resolve();
		};
		runner
			.run(code, plan, {
				record: (key, record) => {
					outputs[key] = record;
					arm();
				},
				progress: onProgress,
				// The program is built only now, which can take a while, so the clock starts here.
				started: arm
			})
			.then((r) => {
				stdout = r.stdout;
				crash = r.crash ?? null;
			})
			.catch((err: unknown) => {
				compileError = err instanceof Error ? err.message : String(err);
			})
			.finally(() => resolve());
	});
	clearTimeout(timer);
	if (timedOut) stdout = runner.printed();
	// The program died part way: the call it was on gets the reason, and the rest are shown as not run.
	if (crash) {
		const dead = plan.calls.find((c) => !(c.key in outputs));
		if (dead) outputs[dead.key] = { error: friendlyCrash(crash), fatal: true };
	}
	return { outputs, stdout, compileError, timedOut };
}

export async function runExternalTests(options: ExternalRunOptions): Promise<SubmissionResult> {
	const { runner, code, harness, contentId, sampleLimit, onProgress } = options;
	const isSample = typeof sampleLimit === 'number' && sampleLimit > 0;
	const started = performance.now();

	onProgress('Preparing the tests (this needs Python the first time)...');
	const maxInt = MAX_INT[runner.language];
	const prepared = await pyodideService.prepareExternal(
		harness,
		maxInt === null || maxInt === undefined ? '' : String(maxInt),
		isSample ? sampleLimit : undefined
	);
	if (prepared.error || !prepared.plan) {
		return failedBeforeTests(
			contentId,
			isSample,
			prepared.error ?? 'The tests could not be prepared.'
		);
	}

	const { outputs, stdout, compileError } = await execute(runner, code, prepared.plan, onProgress);
	if (compileError) return failedBeforeTests(contentId, isSample, compileError);

	onProgress('Checking the answers...');
	const judged = await pyodideService.judgeExternal(
		harness,
		outputs,
		isSample ? sampleLimit : undefined
	);
	if (judged.error) return failedBeforeTests(contentId, isSample, judged.error, stdout);

	const results: SingleTestResult[] = judged.results.map((t) => ({
		name: t.name,
		passed: t.passed,
		durationMs: 1,
		error: t.error ?? undefined,
		skipped: t.skipped || undefined
	}));
	const passedTests = results.filter((t) => t.passed).length;
	const notes = judged.notes.map((n) => `Note: ${n}`);
	return {
		contentId,
		totalTests: results.length,
		passedTests,
		failedTests: results.length - passedTests,
		// Tests that could not run here do not count as a pass: some test has to have really run and passed.
		allPassed: passedTests === results.length && results.some((t) => !t.skipped),
		totalDurationMs: Math.round(performance.now() - started),
		results,
		rawOutput: [stdout.trim(), ...notes].filter(Boolean).join('\n\n'),
		isSample
	};
}

// Same comparison as the custom run in Python (build-custom-run-script.ts): numbers within 1e-5.
function valuesMatch(actual: unknown, expected: unknown): boolean {
	if (typeof actual === 'number' && typeof expected === 'number') {
		return Math.abs(actual - expected) <= 1e-5;
	}
	if (Array.isArray(actual) && Array.isArray(expected)) {
		return actual.length === expected.length && actual.every((v, i) => valuesMatch(v, expected[i]));
	}
	if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
		const a = actual as Record<string, unknown>;
		const e = expected as Record<string, unknown>;
		const keys = Object.keys(a);
		return (
			keys.length === Object.keys(e).length && keys.every((k) => k in e && valuesMatch(a[k], e[k]))
		);
	}
	return actual === expected;
}

/**
 * The "custom input" box: one call of the question's function on the student's own arguments. Only the
 * question's own function can be run (a typed language has to be told its signature), which is the one
 * the tests use.
 */
export async function runExternalCustom(options: {
	runner: ExternalRunner;
	code: string;
	harness: string;
	functionName: string;
	argumentsJson: string;
	expectedJson: string;
	onProgress: (message: string) => void;
}): Promise<ExecutionResult> {
	const { runner, code, harness, functionName, argumentsJson, expectedJson, onProgress } = options;
	const fail = (error: string, output = ''): ExecutionResult => ({
		success: false,
		output: [output, error].filter(Boolean).join('\n\n'),
		error,
		durationMs: 0
	});
	const started = performance.now();

	let args: unknown;
	try {
		args = JSON.parse(argumentsJson || '[]');
	} catch {
		return fail('Arguments must be a JSON array, for example [2, 3].');
	}
	if (!Array.isArray(args)) return fail('Arguments must be a JSON array, for example [2, 3].');
	let expected: unknown;
	const expectedText = (expectedJson || '').trim();
	if (expectedText) {
		try {
			expected = JSON.parse(expectedText);
		} catch {
			return fail('The expected result must be JSON, for example [0, 1].');
		}
	}

	onProgress('Preparing the call (this needs Python the first time)...');
	const prepared = await pyodideService.prepareExternal(harness, '', 1);
	if (prepared.error || !prepared.plan) {
		return fail(prepared.error ?? 'The question could not be prepared.');
	}
	const signature = prepared.plan.function;
	if (!functionName.trim()) return fail('Enter the function name to run.');
	// The starter spells it the way the language does (two_sum is twoSum), and either spelling is accepted.
	const spelled = ident(runner.language as StarterLanguage, signature.name);
	if (![signature.name, spelled].includes(functionName.trim())) {
		return fail(
			`In this language only ${spelled} can be run here, because it needs to know the types. ` +
				`Use the question's function name, or Run to try the examples.`
		);
	}
	if (args.length !== signature.params.length) {
		return fail(
			`${spelled} takes ${signature.params.length} argument${signature.params.length === 1 ? '' : 's'} ` +
				`(${signature.params.map((p) => p.name).join(', ')}) but you gave ${args.length}.`
		);
	}
	// A linked list is given as its list of values; everything else is already the plain JSON it is.
	const wire = args.map((value, i) => {
		const type = signature.params[i].type;
		const listOf = (v: unknown) => ({ values: v, cycle: -1, join: null });
		if (type === 'ListNode') return listOf(value);
		if (type === 'list[ListNode]' && Array.isArray(value)) return value.map(listOf);
		return value;
	});
	const maxInt = MAX_INT[runner.language];
	const plan: ExternalPlan = {
		function: signature,
		compare: 'exact',
		calls: [
			{
				key: 'custom:0',
				case: 'custom',
				index: 0,
				args: wire,
				limitMs: 10_000,
				perf: false,
				reads: false,
				batch: false,
				...(typeof maxInt === 'number' && JSON.stringify(wire).match(/\d{17,}/)
					? { unsupported: 'this number is bigger than this language can hold exactly.' }
					: {})
			}
		]
	};

	const { outputs, stdout, compileError, timedOut } = await execute(runner, code, plan, onProgress);
	if (compileError) return fail(compileError);
	const record = outputs['custom:0'];
	const durationMs = Math.round(performance.now() - started);
	if (!record) {
		return fail(
			timedOut
				? 'Time limit exceeded: your program did not finish, so it was stopped. Look for an infinite loop.'
				: 'Your program did not report an answer.',
			stdout.trim()
		);
	}
	if ('unsupported' in record) return fail(`Skipped: ${record.unsupported}`, stdout.trim());
	if ('error' in record) return fail(`Runtime error: ${record.error}`, stdout.trim());
	if (!('out' in record) && !('outJson' in record)) {
		return fail('Your program did not report an answer.', stdout.trim());
	}
	// A typed language sends the answer as JSON text so a 64-bit integer keeps its digits.
	const returned = 'outJson' in record ? record.outJson : JSON.stringify(record.out);
	const value: unknown = 'outJson' in record ? JSON.parse(record.outJson) : record.out;

	let output = stdout.trim();
	output += `${output ? '\n' : ''}Returned: ${returned}`;
	if (expectedText) {
		if (valuesMatch(value, expected)) {
			output += '\nExpected result matched.';
		} else {
			const error = `Expected ${JSON.stringify(expected)}, got ${returned}.`;
			return { success: false, output, error, durationMs };
		}
	}
	return { success: true, output, durationMs };
}
