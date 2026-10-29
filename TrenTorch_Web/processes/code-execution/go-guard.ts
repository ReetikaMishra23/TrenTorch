// Keeps the Yaegi interpreter (a Go program compiled to WebAssembly) usable. It exits for good when Go's own
// runtime hits a fatal error ("found bad pointer in Go heap" turns up after a few hundred evaluations), and
// also when the interpreter panics on some compile errors. Either way every later call would fail, so this
// starts a fresh instance in its place: after a number of evaluations before it can happen, and after a death
// that was the runtime's fault, retrying the evaluation on a fresh one. A death caused by the student's own code is
// reported with the reason instead, because running it again would only die again.

export interface GoResult {
	output: string;
	error: string | null;
}
export type RunGo = (source: string) => GoResult;

/** Evaluations an instance serves before it is replaced. Well under where the heap error has been seen. */
export const GO_INSTANCE_USES = 60;

/** The runtime's own faults are rare and independent, so a couple of fresh instances is plenty. */
const MAX_TRIES = 3;

export interface GoDeath {
	/** The interpreter's reason, when the student's code caused it ("2:36: incomplete type x"). */
	reason: string | null;
}

export function guardGo(options: {
	start: () => Promise<RunGo>;
	/** What the Go runtime has written to stderr since `clearStderr`. */
	stderr: () => string;
	clearStderr: () => void;
}) {
	let current: RunGo | null = null;
	let uses = 0;

	const alive = (r: unknown): r is GoResult =>
		typeof r === 'object' && r !== null && typeof (r as GoResult).output === 'string';

	const attempt = (run: RunGo, source: string): GoResult | null => {
		try {
			const result = run(source);
			return alive(result) ? result : null;
		} catch {
			return null;
		}
	};

	return {
		/** Runs the source; resolves with its result, or with the reason the interpreter died. */
		async run(source: string): Promise<GoResult | GoDeath> {
			for (let tries = 0; tries < MAX_TRIES; tries++) {
				if (!current || uses >= GO_INSTANCE_USES) {
					current = await options.start();
					uses = 0;
				}
				options.clearStderr();
				uses++;
				const result = attempt(current, source);
				if (result) return result;
				current = null; // dead: the next use starts a new one
				const text = options.stderr();
				const reason = /panic: (\d+:\d+: [^\n[]*)/.exec(text)?.[1]?.trim() ?? null;
				// The student's code made the interpreter panic: running it again would do the same.
				if (reason) return { reason };
				// Anything else was Go's own runtime failing: try again on a fresh instance.
			}
			return { reason: null };
		}
	};
}

export const diedOf = (r: GoResult | GoDeath): r is GoDeath => !('output' in r);
