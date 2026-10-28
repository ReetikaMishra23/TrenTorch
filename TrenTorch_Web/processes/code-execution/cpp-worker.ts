// Web Worker for C++ execution via JSCPP, a C++ subset interpreter (not a
// true compiler) loaded from jsDelivr on first use. It supports <iostream>,
// <cmath>, <cstring>, <cstdlib>, <cstdio>, <cctype>, <ctime> and <iomanip>
// only: there is no <vector>, <string> or <map>, so code that uses them
// fails with "cannot find library". Only the browser builds up to 2.0.6 are
// published on the CDN.
/* eslint-disable @typescript-eslint/no-explicit-any */

declare const JSCPP: any;

let loaded = false;
async function ensureJscpp(): Promise<void> {
	if (loaded) return;
	// @ts-expect-error -- importScripts is a Worker global, not in the TS lib for modules
	importScripts('https://cdn.jsdelivr.net/npm/JSCPP@2.0.6/dist/JSCPP.es5.min.js');
	loaded = true;
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
			await ensureJscpp();
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
			await ensureJscpp();
			self.postMessage({ type: 'status', status: 'running' });
			const startTime = performance.now();
			const lines: string[] = [];
			let error: string | undefined;
			try {
				JSCPP.run(code || '', '', {
					stdio: {
						write(s: string) {
							lines.push(s);
							return s.length;
						}
					}
				});
			} catch (err: any) {
				error = err?.message || String(err);
			}
			self.postMessage({
				id,
				type: 'run_result',
				success: !error,
				output: lines.join(''),
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
