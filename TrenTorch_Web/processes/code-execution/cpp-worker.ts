// Web Worker for C++ execution via JSCPP, a C++ subset interpreter (not a
// true compiler) loaded from jsDelivr on first use. Handles the common
// subset DSA solutions need: control flow, STL vector/string/map basics,
// <iostream>. Not full ISO C++ -- advanced template metaprogramming or
// less-common STL headers may not run.
/* eslint-disable @typescript-eslint/no-explicit-any */

declare const JSCPP: any;

let loaded = false;
async function ensureJscpp(): Promise<void> {
	if (loaded) return;
	// @ts-expect-error -- importScripts is a Worker global, not in the TS lib for modules
	importScripts('https://cdn.jsdelivr.net/npm/JSCPP@2.0.11/dist/JSCPP.es5.js');
	loaded = true;
}

self.onmessage = async (e: MessageEvent) => {
	const trustedOrigins = new Set([self.location.origin, 'null']);
	const messageOrigin = typeof e.origin === 'string' ? e.origin : '';
	if (messageOrigin && !trustedOrigins.has(messageOrigin)) {
		self.postMessage({ type: 'error', error: `Untrusted message origin: ${messageOrigin}` });
		return;
	}

	const { id, action, code } = e.data;

	if (action === 'init') {
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
