// Web Worker for Go execution via Yaegi (a Go interpreter) compiled to WASM
// ourselves (see processes/code-execution/go-wasm-src). The binary (yaegi.wasm.gz, 38 MB
// raw, 8 MB gzipped) and its wasm_exec.js glue are static assets, fetched when the
// student picks Go. It is gzipped on disk and decompressed here, not via Content-Encoding,
// so the host serves it as-is.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { buildGoDriver } from './external-driver-go';
import { encodeCalls } from './external-codec';
import { runTyped } from './typed-run';
import { diedOf, guardGo, type RunGo } from './go-guard';

declare function importScripts(...urls: string[]): void;
declare const Go: {
	new (): { importObject: WebAssembly.Imports; run(instance: WebAssembly.Instance): Promise<void> };
};
declare const runGo: (source: string) => { output: string; error: string | null };

// What the Go runtime wrote to its stderr. Yaegi panics (and the runtime exits) on some compile errors, and the
// reason is only printed there.
let goStderr = '';

let runtimeReady: Promise<void> | null = null;
let wasmModule: WebAssembly.Module | null = null;

// Starts one interpreter instance and hands back its runGo. The compiled module is kept, so replacing a dead
// instance costs a moment, not another download.
async function startInstance(): Promise<RunGo> {
	if (!wasmModule) {
		importScripts('/go-runtime/wasm_exec.js');
		const fs = (globalThis as any).fs;
		const writeSync = fs.writeSync.bind(fs);
		fs.writeSync = (fd: number, buf: Uint8Array) => {
			if (fd === 2) goStderr += new TextDecoder().decode(buf);
			return writeSync(fd, buf);
		};
		const resp = await fetch('/go-runtime/yaegi.wasm.gz');
		if (!resp.ok || !resp.body) throw new Error(`fetch /go-runtime/yaegi.wasm.gz: ${resp.status}`);
		const bytes = await new Response(
			resp.body.pipeThrough(new DecompressionStream('gzip'))
		).arrayBuffer();
		wasmModule = await WebAssembly.compile(bytes);
	}
	const go = new Go();
	const instance = await WebAssembly.instantiate(wasmModule, go.importObject);
	// main() blocks on `select {}` to stay alive, so go.run() never resolves --
	// runGo() becomes callable as soon as js.Global().Set() runs inside it.
	void go.run(instance);
	await new Promise((resolve) => setTimeout(resolve, 50));
	return runGo;
}

const guard = guardGo({
	start: startInstance,
	stderr: () => goStderr,
	clearStderr: () => {
		goStderr = '';
	}
});

function ensureRuntime(): Promise<void> {
	if (runtimeReady) return runtimeReady;
	runtimeReady = (async () => {
		await guard.run('package main\nfunc main() {}\n');
	})();
	runtimeReady.catch(() => {
		runtimeReady = null;
	});
	return runtimeReady;
}

// An interpreter instance that has exited still has timers pending; when they fire they throw. That is the
// dead instance's last gasp, not a problem with the worker.
self.addEventListener('error', (e) => {
	if (/already exited/.test(e.message)) e.preventDefault();
});

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
		// A submission, one test case at a time (see typed-run.ts): Yaegi only hands back its output when a
		// run ends, so this keeps the answers of the cases before one that gets stuck.
		self.postMessage({ type: 'external_progress', message: 'Loading the Go interpreter...' });
		try {
			await ensureRuntime();
			self.postMessage({ type: 'external_progress', message: 'Running...' });
			await runTyped({
				language: 'go',
				source: e.data.code || '',
				plan: e.data.plan,
				chunkByCase: true,
				buildDriver: (source, plan, code) =>
					buildGoDriver(source, plan.function, code, encodeCalls(plan.function, plan.calls)),
				post: (message) => self.postMessage(message),
				executor: {
					async execute(driver, _input, hooks) {
						hooks.started();
						const outcome = await guard.run(driver);
						if (diedOf(outcome)) {
							return {
								buildError:
									outcome.reason ??
									'The Go interpreter crashed unexpectedly (not because of your code). Run it again.'
							};
						}
						const result = outcome;
						hooks.onText(result.output);
						// Yaegi runs main() while evaluating, so its later main.main lookup always complains.
						const error =
							result.error && !/undefined selector: main\b/.test(result.error)
								? result.error
								: null;
						if (!error) return {};
						// "12:5: undefined: x" is the code not building; anything else is the program dying.
						return /^\d+:\d+: /.test(error) ? { buildError: error } : { crash: error };
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
			const outcome = await guard.run(code || '');
			const result = diedOf(outcome)
				? {
						output: '',
						error:
							outcome.reason ??
							'The Go interpreter crashed unexpectedly (not because of your code). Run it again.'
					}
				: outcome;
			// Yaegi already runs main() while it evaluates a `package main` source. The runner then
			// evaluates `main.main()` a second time, which fails with this error even though the program
			// ran fine. Drop it (the current yaegi.wasm still does this; see go-wasm-src/main.go).
			const error =
				result.error && /undefined selector: main\b/.test(result.error) ? null : result.error;
			self.postMessage({
				id,
				type: 'run_result',
				success: !error,
				output: result.output,
				error,
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
