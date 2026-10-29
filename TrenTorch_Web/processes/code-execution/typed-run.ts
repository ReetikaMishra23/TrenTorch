import type { ExternalCall, ExternalPlan, ExternalRecord } from './external-protocol';
import {
	encodeCalls,
	markNodeLimits,
	parseResultLine,
	unsupportedReason,
	type TypedLanguage
} from './external-codec';

// What every typed language's worker does for a submission, apart from compiling and running the program,
// which is the one part that differs (`execute`). See worker-runner.ts for the messages posted.

export interface TypedExecution {
	/** The program built; its first call is about to be made. */
	started: () => void;
	/** Everything the program wrote to stdout, as it is written. */
	onText: (text: string) => void;
	/** The word that starts every answer line of this run. */
	code: string;
}

export interface TypedExecutor {
	/**
	 * Build and run the driver program with `input` as the text it reads. Resolves with the build error
	 * (nothing ran) or the crash message (it ran but did not finish), or neither when it ended normally.
	 */
	execute(
		driver: string,
		input: string,
		hooks: TypedExecution
	): Promise<{ buildError?: string; crash?: string; restart?: boolean }>;
}

export async function runTyped(options: {
	language: TypedLanguage;
	source: string;
	plan: ExternalPlan;
	/** Wraps the student's source with the driver, using the word that marks answer lines. */
	buildDriver: (source: string, plan: ExternalPlan, code: string) => string;
	executor: TypedExecutor;
	chunkByCase?: boolean;
	post: (message: Record<string, unknown>) => void;
}): Promise<void> {
	const { language, source, plan, buildDriver, executor, post } = options;
	const emit = (key: string, record: ExternalRecord) =>
		post({ type: 'external_record', key, record });

	const reason = unsupportedReason(plan.function);
	if (reason) {
		for (const call of plan.calls) emit(call.key, { unsupported: reason });
		post({ type: 'external_done' });
		return;
	}
	markNodeLimits(plan, language);
	const runnable = plan.calls.filter((c) => !c.unsupported);
	for (const call of plan.calls)
		if (call.unsupported) emit(call.key, { unsupported: call.unsupported });
	if (!runnable.length) {
		post({ type: 'external_done' });
		return;
	}

	// A word nothing the student prints can be expected to match, so their output is never read as an answer.
	const code = 'TT' + crypto.randomUUID().replaceAll('-', '');

	// One run for everything, or, for a language that only reports its output when it ends, one run per test
	// case: a program stuck in one case then only loses that case, not the answers before it.
	const chunks: ExternalCall[][] = [];
	if (options.chunkByCase) {
		for (const call of runnable) {
			const last = chunks[chunks.length - 1];
			if (last && last[0].case === call.case) last.push(call);
			else chunks.push([call]);
		}
	} else chunks.push(runnable);

	let slow = false;
	for (const chunk of chunks) {
		// A performance test after a slow one is not run (a driver that runs everything in one go decides
		// this itself, see the drivers).
		if (options.chunkByCase && chunk[0].perf && slow) {
			for (const call of chunk) emit(call.key, { skip: true });
			continue;
		}
		const sub: ExternalPlan = { ...plan, calls: chunk };
		const driver = buildDriver(source, sub, code);
		const input = encodeCalls(plan.function, chunk);

		let pending = '';
		const handle = (line: string) => {
			const parsed = parseResultLine(line, code, plan.function, chunk);
			if (!parsed) {
				post({ type: 'external_stdout', text: line + '\n' });
				return;
			}
			const call = chunk[parsed.id];
			if ('ms' in parsed.record && call.perf && parsed.record.ms > call.limitMs) slow = true;
			emit(call.key, parsed.record);
		};
		const result = await executor.execute(driver, input, {
			code,
			started: () => post({ type: 'external_started' }),
			onText: (text) => {
				pending += text;
				let at: number;
				while ((at = pending.indexOf('\n')) >= 0) {
					handle(pending.slice(0, at));
					pending = pending.slice(at + 1);
				}
			}
		});
		if (pending) handle(pending);
		if (result.buildError) {
			post({ type: 'external_failed', error: result.buildError, restart: result.restart });
			return;
		}
		if (result.crash) {
			post({ type: 'external_done', crash: result.crash });
			return;
		}
	}
	post({ type: 'external_done' });
}
