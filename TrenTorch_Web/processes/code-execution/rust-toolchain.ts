// Compiles and runs Rust with a real rustc compiled to WebAssembly (wasm32-wasip1, from the
// Weblings/rust-in-wasm project) over a pure-JS WASI shim. Nothing here touches the DOM or fetch, so it
// runs in a worker and under Node (see rust-toolchain.spec.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fd, File, Directory, PreopenDirectory, WASI } from './rust-vendor/index.js';

type Sysroot = Map<string, InstanceType<typeof File>>;

export interface RustToolchainAssets {
	rustc: WebAssembly.Module;
	sysroot: Sysroot;
}

export interface RustRunOptions {
	/** Files the program can read under /sandbox. */
	inputs?: Record<string, string>;
	/** The program's stdout, as it is written. */
	onStdout?: (text: string) => void;
	/** The program is built and about to start. */
	onStart?: () => void;
}

export interface RustRunResult {
	output: string;
	error: string | null;
	/** The program compiled (the error, if any, may then be only compiler warnings). */
	built: boolean;
	/** The program started but did not finish normally. */
	crashed: boolean;
}

// Parse the RIWB1 sysroot bundle: "RIWB1\n" + u32le index length + JSON index
// {files:[{p,o,l}], total} + concatenated bytes.
export function parseBundle(bytes: Uint8Array): Sysroot {
	const magic = new TextDecoder().decode(bytes.subarray(0, 6));
	if (magic !== 'RIWB1\n') throw new Error('bad sysroot bundle magic');
	const ilen = new DataView(bytes.buffer, bytes.byteOffset + 6, 4).getUint32(0, true);
	const index = JSON.parse(new TextDecoder().decode(bytes.subarray(10, 10 + ilen)));
	const base = 10 + ilen;
	const files: Sysroot = new Map();
	for (const f of index.files) {
		if (f.p === 'manifest.json') continue;
		files.set(f.p, new File(bytes.slice(base + f.o, base + f.o + f.l)));
	}
	return files;
}

function stdSysrootPreopen(stdSysroot: Sysroot): InstanceType<typeof PreopenDirectory> {
	const root = new Map<string, any>();
	const dirFor = (segs: string[]) => {
		let m = root;
		for (const seg of segs) {
			if (!m.has(seg)) m.set(seg, new Map());
			m = m.get(seg);
		}
		return m;
	};
	for (const [path, file] of stdSysroot) {
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

// eslint-disable-next-line no-control-regex
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

export class RustToolchain {
	private chain: Promise<unknown> = Promise.resolve();

	constructor(private readonly assets: RustToolchainAssets) {}

	/** Compile and run one program. Calls are queued, because each one needs the shared sysroot. */
	run(source: string, options: RustRunOptions = {}): Promise<RustRunResult> {
		const result = this.chain.then(() => this.runNow(source, options));
		this.chain = result.catch(() => undefined);
		return result;
	}

	private async runNow(source: string, options: RustRunOptions): Promise<RustRunResult> {
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
			// Allow unused code: a starter's stub intentionally ignores its parameters.
			'-Aunused',
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
			stdSysrootPreopen(this.assets.sysroot),
			work
		];
		const w = new WASI(args, ['CLIF2WASM_OBJECT=1'], fds, { debug: false });
		const inst = await WebAssembly.instantiate(this.assets.rustc, {
			wasi_snapshot_preview1: w.wasiImport
		});
		let exit: number;
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
			return { output: '', error: residue, built: false, crashed: false };
		}

		let progOut = '';
		let progErr = '';
		const dec1 = new TextDecoder();
		const dec2 = new TextDecoder();
		class CapOut extends Fd {
			fd_write(data: Uint8Array) {
				const chunk = dec1.decode(data, { stream: true });
				options.onStdout?.(chunk);
				progOut += chunk;
				return { ret: 0, nwritten: data.byteLength };
			}
		}
		class CapErrStream extends Fd {
			fd_write(data: Uint8Array) {
				progErr += dec2.decode(data, { stream: true });
				return { ret: 0, nwritten: data.byteLength };
			}
		}
		const pfds = [
			new CapOut(),
			new CapOut(),
			new CapErrStream(),
			new PreopenDirectory(
				'/sandbox',
				Object.entries(options.inputs ?? {}).map(([name, text]) => [
					name,
					new File(new TextEncoder().encode(text))
				])
			)
		];
		const pw = new WASI(['prog'], [], pfds, { debug: false });
		try {
			const { instance } = await WebAssembly.instantiate(bin.data.slice().buffer, {
				wasi_snapshot_preview1: pw.wasiImport
			});
			options.onStart?.();
			const rc = pw.start(instance);
			const stderr = progErr.replaceAll('/work/prog.rs', 'program').trim();
			return {
				output: progOut.trimEnd(),
				error: rc === 0 ? diagnosticText || null : stderr || `process exited with code ${rc}`,
				built: true,
				crashed: rc !== 0
			};
		} catch (e: any) {
			const stderr = progErr.replaceAll('/work/prog.rs', 'program').trim();
			return {
				output: progOut.trimEnd(),
				error: [stderr, String(e?.message || e)].filter(Boolean).join('\n'),
				built: true,
				crashed: true
			};
		}
	}
}
