// Web Worker for Rust execution via a real rustc compiled to WASM (wasm32-wasip1,
// from the Weblings/rust-in-wasm project). Genuinely compiles and runs Rust source
// inside the browser, off the main thread, via a pure-JS WASI shim.
// rustc.wasm (~88MB) and the sysroot bundle (~71MB) are static assets, shipped
// gzip-compressed (~20MB / ~24MB) and fetched lazily only on the first Rust run.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fd, File, Directory, PreopenDirectory, WASI } from './rust-vendor/index.js';

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

let rustcModule: WebAssembly.Module | null = null;
let stdSysroot: Map<string, InstanceType<typeof File>> | null = null;

// Parse the RIWB1 sysroot bundle: "RIWB1\n" + u32le index length + JSON index
// {files:[{p,o,l}], total} + concatenated bytes.
function parseBundle(bytes: Uint8Array): Map<string, InstanceType<typeof File>> {
	const magic = new TextDecoder().decode(bytes.subarray(0, 6));
	if (magic !== 'RIWB1\n') throw new Error('bad sysroot bundle magic');
	const ilen = new DataView(bytes.buffer, bytes.byteOffset + 6, 4).getUint32(0, true);
	const index = JSON.parse(new TextDecoder().decode(bytes.subarray(10, 10 + ilen)));
	const base = 10 + ilen;
	const files = new Map<string, InstanceType<typeof File>>();
	for (const f of index.files) {
		if (f.p === 'manifest.json') continue;
		files.set(f.p, new File(bytes.slice(base + f.o, base + f.o + f.l)));
	}
	return files;
}

function stdSysrootPreopen(): InstanceType<typeof PreopenDirectory> {
	const root = new Map<string, any>();
	const dirFor = (segs: string[]) => {
		let m = root;
		for (const seg of segs) {
			if (!m.has(seg)) m.set(seg, new Map());
			m = m.get(seg);
		}
		return m;
	};
	for (const [path, file] of stdSysroot!) {
		const segs = path.split('/');
		const name = segs.pop()!;
		dirFor(segs).set(name, file);
	}
	const toDir = (m: Map<string, any>): InstanceType<typeof Directory> =>
		new Directory([...m.entries()].map(([n, v]) => [n, v instanceof Map ? toDir(v) : v]));
	return new PreopenDirectory(
		'/sysroot',
		[...root.entries()].map(([n, v]) => [n, v instanceof Map ? toDir(v) : v])
	);
}

let runtimeReady: Promise<void> | null = null;
function ensureRuntime(): Promise<void> {
	if (runtimeReady) return runtimeReady;
	runtimeReady = (async () => {
		const [rustcBytes, bundleBytes] = await Promise.all([
			fetchGunzipped(RUSTC_URL),
			fetchGunzipped(BUNDLE_URL)
		]);
		rustcModule = await WebAssembly.compile(rustcBytes);
		stdSysroot = parseBundle(new Uint8Array(bundleBytes));
	})();
	runtimeReady.catch(() => {
		runtimeReady = null;
	});
	return runtimeReady;
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function parseDiagnostics(log: string): string {
	const errors: string[] = [];
	for (const line of log.split('\n')) {
		if (line[0] !== '{') continue;
		let d: any;
		try {
			d = JSON.parse(line);
		} catch {
			continue;
		}
		if (d.$message_type !== 'diagnostic') continue;
		if (d.level !== 'error' && d.level !== 'warning') continue;
		const rendered = (d.rendered || d.message).trimEnd().replace(ANSI_RE, '');
		errors.push(rendered.replaceAll('/work/prog.rs', 'program'));
	}
	return errors.join('\n\n');
}

async function runRust(source: string): Promise<{ output: string; error: string | null }> {
	let log = '';
	const dec0 = new TextDecoder();
	class CapErr extends Fd {
		fd_write(data: Uint8Array) {
			log += dec0.decode(data, { stream: true });
			return { ret: 0, nwritten: data.byteLength };
		}
	}
	const work = new PreopenDirectory('/work', [
		['prog.rs', new File(new TextEncoder().encode(source))]
	]);
	const args = [
		'rustc',
		'/work/prog.rs',
		'--sysroot',
		'/sysroot',
		'-Zunstable-options',
		'--target',
		'wasm32-wasip1',
		'--edition',
		'2024',
		'-O',
		'-Cpanic=abort',
		'--error-format=json',
		'--json=diagnostic-rendered-ansi',
		'-o',
		'/work/prog.wasm'
	];
	const fds = [
		new CapErr(),
		new CapErr(),
		new CapErr(),
		new PreopenDirectory('/tmp', []),
		stdSysrootPreopen(),
		work
	];
	const w = new WASI(args, ['CLIF2WASM_OBJECT=1'], fds, { debug: false });
	const inst = await WebAssembly.instantiate(rustcModule!, {
		wasi_snapshot_preview1: w.wasiImport
	});
	let exit = 0;
	try {
		exit = w.start(inst);
	} catch (e: any) {
		if (!log.trim()) log += e?.message || String(e);
		exit = 1;
	}

	const diagnosticText = parseDiagnostics(log);
	const bin = (work as any).dir.contents.get('prog.wasm');
	if (!bin || !bin.data || bin.data.length === 0) {
		const residue =
			diagnosticText ||
			log.replaceAll('/work/prog.rs', 'program').trim() ||
			`rustc exited ${exit} without emitting a program`;
		return { output: '', error: residue };
	}

	let progOut = '';
	let progErr = '';
	const dec1 = new TextDecoder();
	const dec2 = new TextDecoder();
	class CapOut extends Fd {
		fd_write(data: Uint8Array) {
			progOut += dec1.decode(data, { stream: true });
			return { ret: 0, nwritten: data.byteLength };
		}
	}
	class CapErrStream extends Fd {
		fd_write(data: Uint8Array) {
			progErr += dec2.decode(data, { stream: true });
			return { ret: 0, nwritten: data.byteLength };
		}
	}
	const pfds = [new CapOut(), new CapOut(), new CapErrStream(), new PreopenDirectory('/sandbox', [])];
	const pw = new WASI(['prog'], [], pfds, { debug: false });
	try {
		const { instance } = await WebAssembly.instantiate(bin.data.slice().buffer, {
			wasi_snapshot_preview1: pw.wasiImport
		});
		const rc = pw.start(instance);
		const stderr = progErr.replaceAll('/work/prog.rs', 'program').trim();
		return {
			output: progOut.trimEnd(),
			error: rc === 0 ? (diagnosticText || null) : stderr || `process exited with code ${rc}`
		};
	} catch (e: any) {
		return { output: progOut.trimEnd(), error: String(e?.message || e) };
	}
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
			const result = await runRust(code || '');
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
