// Web Worker for Go execution via Yaegi (a Go interpreter) compiled to WASM
// ourselves (see processes/code-execution/go-wasm-src). The .wasm binary and
// its wasm_exec.js glue are static assets, fetched lazily on first run.
/* eslint-disable @typescript-eslint/no-explicit-any */

declare function importScripts(...urls: string[]): void;
declare const Go: {
	new (): { importObject: WebAssembly.Imports; run(instance: WebAssembly.Instance): Promise<void> };
};
declare const runGo: (source: string) => { output: string; error: string | null };

let runtimeReady: Promise<void> | null = null;
function ensureRuntime(): Promise<void> {
	if (runtimeReady) return runtimeReady;
	runtimeReady = (async () => {
		importScripts('/go-runtime/wasm_exec.js');
		const go = new Go();
		const resp = await fetch('/go-runtime/yaegi.wasm');
		const { instance } = await WebAssembly.instantiateStreaming(resp, go.importObject);
		// main() blocks on `select {}` to stay alive, so go.run() never resolves --
		// runGo() becomes callable as soon as js.Global().Set() runs inside it.
		void go.run(instance);
		await new Promise((resolve) => setTimeout(resolve, 50));
	})();
	runtimeReady.catch(() => {
		runtimeReady = null;
	});
	return runtimeReady;
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
			const result = runGo(code || '');
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
