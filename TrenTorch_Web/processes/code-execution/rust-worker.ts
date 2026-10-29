// Web Worker for Rust execution via a real rustc compiled to WASM (wasm32-wasip1,
// from the Weblings/rust-in-wasm project). Genuinely compiles and runs Rust source
// inside the browser, off the main thread, via a pure-JS WASI shim.
// rustc.wasm (~88MB) and the sysroot bundle (~71MB) are static assets, shipped
// gzip-compressed (~20MB / ~24MB) and fetched lazily only on the first Rust run.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { RustToolchain, parseBundle } from './rust-toolchain';
import { buildRustDriver } from './external-driver-rust';
import { runTyped } from './typed-run';

const RUSTC_URL = '/rust-runtime/rustc.wasm.gz';
const BUNDLE_URL = '/rust-runtime/sysroot-wasip1.bundle.gz';

// Both assets are pre-gzipped on disk (not served via Content-Encoding), so
// they decompress client-side via the browser's native gzip decoder.
async function fetchGunzipped(url: string): Promise<ArrayBuffer> {
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
	const stream = resp.body!.pipeThrough(new DecompressionStream('gzip'));
	return await new Response(stream).arrayBuffer();
}

let toolchain: RustToolchain | null = null;

let runtimeReady: Promise<void> | null = null;
function ensureRuntime(): Promise<void> {
	if (runtimeReady) return runtimeReady;
	runtimeReady = (async () => {
		const [rustcBytes, bundleBytes] = await Promise.all([
			fetchGunzipped(RUSTC_URL),
			fetchGunzipped(BUNDLE_URL)
		]);
		toolchain = new RustToolchain({
			rustc: await WebAssembly.compile(rustcBytes),
			sysroot: parseBundle(new Uint8Array(bundleBytes))
		});
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

	if (action === 'external') {
		// A submission: the student's code plus a driver that makes each call (see typed-run.ts).
		self.postMessage({
			type: 'external_progress',
			message: 'Loading the Rust compiler (the first time downloads about 44 MB)...'
		});
		try {
			await ensureRuntime();
			self.postMessage({ type: 'external_progress', message: 'Compiling...' });
			await runTyped({
				language: 'rust',
				source: e.data.code || '',
				plan: e.data.plan,
				buildDriver: (source, plan, code) => buildRustDriver(source, plan.function, code),
				post: (message) => self.postMessage(message),
				executor: {
					async execute(driver, input, hooks) {
						const result = await toolchain!.run(driver, {
							inputs: { 'calls.txt': input },
							onStdout: hooks.onText,
							onStart: hooks.started
						});
						return result.built
							? { crash: result.crashed ? (result.error ?? 'The program crashed.') : undefined }
							: { buildError: result.error ?? 'The Rust compiler stopped without a program.' };
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
			const result = await toolchain!.run(code || '');
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
