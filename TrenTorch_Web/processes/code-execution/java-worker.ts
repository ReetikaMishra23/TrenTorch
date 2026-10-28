// Classic (non-module) Worker for Java execution via CheerpJ, a WebAssembly
// JVM. CheerpJ's loader.js is a plain global-exposing script loaded through
// importScripts, which only classic workers support -- see java-service.ts,
// which constructs this worker without `{ type: 'module' }`.
/* eslint-disable @typescript-eslint/no-explicit-any */

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
