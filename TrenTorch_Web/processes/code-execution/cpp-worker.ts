// Web Worker for C++ execution via a real clang and wasm-ld compiled to WebAssembly (LLVM 22,
// wasm32-wasi), so students get actual C++20 with libc++: vector, map, templates, lambdas, references
// and the rest. The compiler, linker and sysroot (platform/static/cpp-runtime/, about 29 MB
// gzipped) are fetched when the student picks C++; compiling is in cpp-toolchain.ts.
//
// Not supported: exceptions (try/catch, throw) and threads, because the sysroot's libc++ is built
// without them.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CppToolchain } from './cpp-toolchain';
import bitsStdcpp from './cpp-bits-stdcpp.h?raw';
import { buildCppDriver } from './external-driver-cpp';
import { runTyped } from './typed-run';

const BASE = '/cpp-runtime/';

// The assets are gzipped on disk (not served via Content-Encoding), so the browser's own gzip decoder
// unpacks them here.
async function gunzip(name: string): Promise<ReadableStream<Uint8Array>> {
	const resp = await fetch(`${BASE}${name}`);
	if (!resp.ok || !resp.body) throw new Error(`fetch ${BASE}${name}: ${resp.status}`);
	return resp.body.pipeThrough(new DecompressionStream('gzip'));
}

// Compile the wasm while it is still downloading and unpacking, which matters for clang's 44 MB.
async function compileWasm(name: string): Promise<WebAssembly.Module> {
	const stream = await gunzip(name);
	const response = new Response(stream, { headers: { 'Content-Type': 'application/wasm' } });
	return WebAssembly.compileStreaming(response);
}

let toolchainReady: Promise<CppToolchain> | null = null;
function ensureToolchain(): Promise<CppToolchain> {
	if (toolchainReady) return toolchainReady;
	toolchainReady = (async () => {
		const [clang, lld, sysroot] = await Promise.all([
			compileWasm('clang.wasm.gz'),
			compileWasm('lld.wasm.gz'),
			(async () =>
				new Uint8Array(await new Response(await gunzip('sysroot.tar.gz')).arrayBuffer()))()
		]);
		return new CppToolchain({ clang, lld, sysroot, bitsStdcpp });
	})();
	// A failed download must not stay cached, or a retry could never succeed.
	toolchainReady.catch(() => {
		toolchainReady = null;
	});
	return toolchainReady;
}

self.onmessage = async (e: MessageEvent) => {
	// A dedicated worker's messages carry an empty origin; anything else must be this site.
	if (e.origin !== '' && e.origin !== self.location.origin && e.origin !== 'null') {
		self.postMessage({ type: 'error', error: `Untrusted message origin: ${e.origin}` });
		return;
	}

	const { id, action, code } = e.data;

	if (action === 'init') {
		// The student just picked this language: fetch the compiler now rather than on the first Run.
		self.postMessage({ type: 'status', status: 'loading_packages' });
		try {
			await ensureToolchain();
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
			message: 'Loading the C++ compiler (the first time downloads about 29 MB)...'
		});
		try {
			const toolchain = await ensureToolchain();
			self.postMessage({ type: 'external_progress', message: 'Compiling...' });
			await runTyped({
				language: 'cpp',
				source: e.data.code || '',
				plan: e.data.plan,
				buildDriver: (source, plan, code) => buildCppDriver(source, plan.function, code),
				post: (message) => self.postMessage(message),
				executor: {
					async execute(driver, input, hooks) {
						const result = await toolchain.run(driver, {
							inputs: { 'calls.txt': input },
							onStdout: hooks.onText,
							onStart: hooks.started
						});
						// Nothing started means the compiler stopped it; otherwise the program ran, and `error` is how it died.
						return result.built
							? { crash: result.error ?? undefined }
							: { buildError: result.error ?? 'The C++ compiler stopped without a program.' };
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
			const toolchain = await ensureToolchain();
			self.postMessage({ type: 'status', status: 'running' });
			const startTime = performance.now();
			const result = await toolchain.run(code || '');
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
