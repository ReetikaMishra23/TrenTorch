// Classic (non-module) Worker for Java execution via CheerpJ, a WebAssembly
// JVM. CheerpJ's loader.js is a plain global-exposing script loaded through
// importScripts, which only classic workers support -- see java-service.ts,
// which constructs this worker without `{ type: 'module' }`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { buildJavaDriver, javaResultsFile } from './external-driver-java';
import { runTyped } from './typed-run';

declare function importScripts(...urls: string[]): void;
declare function cheerpjInit(options?: Record<string, unknown>): Promise<void>;
declare function cheerpjRunMain(...args: string[]): Promise<number>;
declare function cheerpOSAddStringFile(path: string, data: string | Uint8Array): void;
declare function cjFileBlob(path: string): Promise<Blob>;

const LOADER_URL = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
const RUNNER_CLASSPATH = '/str/runner.jar:/str/ecj.jar';

// The jars the runner needs (runner.jar holds Runner.class; rt.jar is the JDK classes ECJ compiles
// against, cut down to the packages student code uses). They are fetched whole and put in CheerpJ's
// in-memory /str/ filesystem instead of being read from /app/: CheerpJ reads /app/ jars with HTTP
// Range requests, and hosts like Cloudflare Pages ignore those, so every run failed with
// "Runner exited with code 1". Runner.class also has to sit in a jar, since CheerpJ cannot load
// classes from a plain /app/ directory.
const JARS = ['runner.jar', 'ecj.jar', 'rt.jar'];

let runtimeReady: Promise<void> | null = null;
function ensureRuntime(): Promise<void> {
	if (runtimeReady) return runtimeReady;
	runtimeReady = (async () => {
		importScripts(LOADER_URL);
		const [jars] = await Promise.all([
			Promise.all(
				JARS.map(async (name) => {
					const resp = await fetch(`/java-runtime/${name}`);
					if (!resp.ok) throw new Error(`fetch /java-runtime/${name}: ${resp.status}`);
					return new Uint8Array(await resp.arrayBuffer());
				})
			),
			cheerpjInit({ version: '17', status: 'none' })
		]);
		JARS.forEach((name, i) => cheerpOSAddStringFile(`/str/${name}`, jars[i]));
	})();
	runtimeReady.catch(() => {
		runtimeReady = null;
	});
	return runtimeReady;
}

// Runner.class (compiled ahead of time, see Runner.java next to it) compiles
// /str/Main.java with the vendored ECJ compiler (CheerpJ's bundled JRE has no
// system Java compiler) and runs its main(String[]), writing every
// diagnostic, program output line, and uncaught exception into one file --
// CheerpJ gives no documented way to intercept System.out/err from JS
// directly, so the file is the handoff point back to this worker.
async function runJava(source: string): Promise<{ output: string; error: string | null }> {
	await ensureRuntime();
	cheerpOSAddStringFile('/str/Main.java', source);
	const outPath = `/files/output-${Date.now()}.txt`;
	let exit: number;
	try {
		exit = await cheerpjRunMain('Runner', RUNNER_CLASSPATH, '/str/Main.java', outPath);
	} catch (e: any) {
		return { output: '', error: e?.message || String(e) };
	}
	let text = '';
	try {
		const blob = await cjFileBlob(outPath);
		text = await blob.text();
	} catch {
		// Runner never reached its finally block (e.g. CheerpJ itself crashed).
	}
	if (!text && exit !== 0) {
		return { output: '', error: `Runner exited with code ${exit}` };
	}
	return { output: text, error: null };
}

self.onmessage = async (e: MessageEvent) => {
	// A dedicated worker's messages carry an empty origin; anything else must be this site.
	if (e.origin !== '' && e.origin !== self.location.origin && e.origin !== 'null') {
		self.postMessage({ type: 'error', error: `Untrusted message origin: ${e.origin}` });
		return;
	}

	const { id, action, code } = e.data;

	if (action === 'init') {
		// The student just picked this language: fetch its runtime now rather than on the first Run.
		self.postMessage({ type: 'status', status: 'loading_packages' });
		try {
			await ensureRuntime();
			self.postMessage({ type: 'status', status: 'ready' });
		} catch {
			// Stay quiet; the first Run tries again and reports the real error.
			self.postMessage({ type: 'status', status: 'uninitialized' });
		}
		self.postMessage({ id, type: 'init_complete', success: true });
		return;
	}

	if (action === 'external') {
		// A submission. The driver appends each answer to a results file while the program runs, and this reads
		// the file as it grows, so a program that gets stuck still leaves the answers before it.
		self.postMessage({
			type: 'external_progress',
			message: 'Loading Java (the first time downloads the compiler)...'
		});
		try {
			await ensureRuntime();
			self.postMessage({ type: 'external_progress', message: 'Compiling...' });
			await runTyped({
				language: 'java',
				source: e.data.code || '',
				plan: e.data.plan,
				buildDriver: (source, plan, code) => buildJavaDriver(source, plan.function, code),
				post: (message) => self.postMessage(message),
				executor: {
					async execute(driver, input, hooks) {
						const resultsPath = javaResultsFile(hooks.code);
						const outPath = `/files/output-${hooks.code}.txt`;
						cheerpOSAddStringFile('/str/calls.txt', input);
						cheerpOSAddStringFile('/str/Main.java', driver);
						let seen = 0;
						let started = false;
						const drain = async () => {
							let text: string;
							try {
								text = await (await cjFileBlob(resultsPath)).text();
							} catch {
								return; // not written yet
							}
							const end = text.lastIndexOf('\n') + 1;
							const fresh = text.slice(seen, end);
							seen = end;
							for (const line of fresh.split('\n')) {
								if (line === `${hooks.code} start`) {
									started = true;
									hooks.started();
								} else if (line) hooks.onText(line + '\n');
							}
						};
						let finished = false;
						const poll = (async () => {
							while (!finished) {
								await drain();
								await new Promise((r) => setTimeout(r, 200));
							}
						})();
						let exit: number;
						try {
							exit = await cheerpjRunMain('Runner', RUNNER_CLASSPATH, '/str/Main.java', outPath);
						} finally {
							finished = true;
							await poll;
						}
						await drain();
						let output = '';
						try {
							output = await (await cjFileBlob(outPath)).text();
						} catch {
							// Runner never wrote it: CheerpJ itself failed.
						}
						if (!started) {
							// The program never began: the compiler's messages are the reason.
							return { buildError: output.trim() || `Runner exited with code ${exit}` };
						}
						// What the student printed, then how it ended if it did not end well.
						if (output.trim()) hooks.onText(output.trim() + '\n');
						return /Exception in thread|^error: /m.test(output) ? { crash: output.trim() } : {};
					}
				}
			});
		} catch (err: any) {
			self.postMessage({ type: 'external_failed', error: err?.message || String(err) });
		}
		return;
	}

	if (action === 'run') {
		try {
			self.postMessage({ type: 'status', status: 'loading_packages' });
			await ensureRuntime();
			self.postMessage({ type: 'status', status: 'running' });
			const startTime = performance.now();
			const result = await runJava(code || '');
			self.postMessage({
				id,
				type: 'run_result',
				success: !result.error,
				output: result.output,
				error: result.error,
				durationMs: Math.round(performance.now() - startTime)
			});
			self.postMessage({ type: 'status', status: 'ready' });
		} catch (err: any) {
			self.postMessage({ id, type: 'error', error: err?.message || String(err) });
			self.postMessage({ type: 'status', status: 'ready' });
		}
	}
};

export {};
