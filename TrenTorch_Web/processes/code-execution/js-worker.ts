// Web Worker for native JavaScript execution. No runtime to download -- the
// worker's own JS engine runs the student's code directly, inside a
// function body so top-level `return` and strict mode both work the same
// way Pyodide's run action behaves for Python.
self.onmessage = async (e: MessageEvent) => {
	// A dedicated worker's messages carry an empty origin; anything else must be this site.
	if (e.origin !== '' && e.origin !== self.location.origin && e.origin !== 'null') {
		self.postMessage({ type: 'error', error: `Untrusted message origin: ${e.origin}` });
		return;
	}

	const { id, action, code } = e.data;

	if (action === 'init') {
		// Nothing to download, so the runtime is ready as soon as the worker exists.
		self.postMessage({ type: 'status', status: 'ready' });
		self.postMessage({ id, type: 'init_complete', success: true });
		return;
	}

	if (action === 'run') {
		self.postMessage({ type: 'status', status: 'running' });
		const startTime = performance.now();
		const lines: string[] = [];
		const print = (...args: unknown[]) =>
			lines.push(
				args
					.map((a) =>
						typeof a === 'string' ? a : a === undefined ? 'undefined' : JSON.stringify(a, null, 2)
					)
					.join(' ')
			);
		let error: string | undefined;
		try {
			const fn = new Function('console', `"use strict";\n${code || ''}`);
			fn({ log: print, error: print, warn: print, info: print });
		} catch (err) {
			error = err instanceof Error ? err.stack || err.message : String(err);
		}
		self.postMessage({
			id,
			type: 'run_result',
			success: !error,
			output: lines.join('\n'),
			error,
			durationMs: Math.round(performance.now() - startTime)
		});
		self.postMessage({ type: 'status', status: 'ready' });
		return;
	}
};

export {};
