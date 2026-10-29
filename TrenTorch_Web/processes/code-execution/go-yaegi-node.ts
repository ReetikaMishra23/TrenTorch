// Runs Go source in the real Yaegi interpreter (platform/static/go-runtime) under Node, for tests, kept alive
// the same way the worker keeps it alive (go-guard.ts).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
import { diedOf, guardGo, type GoResult, type RunGo } from './go-guard';

const root = new URL('../../platform/static/go-runtime/', import.meta.url);

export async function loadYaegi(): Promise<(source: string) => Promise<GoResult>> {
	vm.runInThisContext(readFileSync(new URL('wasm_exec.js', root), 'utf8'));
	const g = globalThis as unknown as {
		Go: new () => {
			importObject: WebAssembly.Imports;
			run(i: WebAssembly.Instance): Promise<void>;
		};
		runGo: RunGo;
		fs: { writeSync: (fd: number, buf: Uint8Array) => number };
	};
	// A dead instance's pending timers throw when they fire; that is not the test's problem.
	process.on('uncaughtException', (err) => {
		if (!/already exited/.test(String(err))) throw err;
	});
	let stderr = '';
	g.fs.writeSync = (fd, buf) => {
		if (fd === 2) stderr += new TextDecoder().decode(buf);
		// What Go prints to stderr is the test's business, not noise for the console.
		return buf.length;
	};
	const module = await WebAssembly.compile(
		gunzipSync(readFileSync(new URL('yaegi.wasm.gz', root)))
	);
	const guard = guardGo({
		start: async () => {
			const go = new g.Go();
			void go.run(await WebAssembly.instantiate(module, go.importObject));
			await new Promise((resolve) => setTimeout(resolve, 20));
			return g.runGo;
		},
		stderr: () => stderr,
		clearStderr: () => {
			stderr = '';
		}
	});
	return async (source) => {
		const outcome = await guard.run(source);
		return diedOf(outcome)
			? { output: '', error: outcome.reason ?? 'The Go interpreter stopped.' }
			: outcome;
	};
}
