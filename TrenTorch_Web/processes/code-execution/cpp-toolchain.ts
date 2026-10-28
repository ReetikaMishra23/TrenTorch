// C++ in the browser: clang and wasm-ld, both compiled to WebAssembly (wasm32-wasi), run one after the
// other over an in-memory copy of the libc++/wasi-libc sysroot, then the program they produce runs on
// the same WASI shim. Nothing here touches the DOM or fetch, so it runs in a worker and under Node
// (cpp-toolchain.spec.ts). The assets and where they come from: platform/static/cpp-runtime/NOTICE.md.
//
// The shim is the one vendored for the Rust runtime.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fd, File, Directory, PreopenDirectory, WASI, wasi } from './rust-vendor/index.js';
import { parseTar } from './parse-tar';

// Must match the LLVM release in the sysroot (/lib/clang/<major> holds its builtin headers and runtime).
const RESOURCE_DIR = '/lib/clang/22';
const STACK_BYTES = 8 * 1024 * 1024;
// The most memory a program may grow to, so a runaway allocation fails instead of taking the tab down.
const MAX_MEMORY_BYTES = 512 * 1024 * 1024;
// Cap on what one program may print, so an endless print loop cannot fill the page.
const MAX_OUTPUT_CHARS = 1_000_000;

export interface CppToolchainAssets {
	clang: WebAssembly.Module;
	lld: WebAssembly.Module;
	/** The decompressed sysroot tar. */
	sysroot: Uint8Array;
	/** Replacement for include/bits/stdc++.h, which the sysroot ships cut down. */
	bitsStdcpp: string;
}

export interface CppRunResult {
	/** What the program printed to stdout. */
	output: string;
	/** Compiler diagnostics, or what the program wrote to stderr / how it exited; null when all is well. */
	error: string | null;
	compileMs: number;
	linkMs: number;
	runMs: number;
}

// stdin, stdout and stderr that look like a terminal. LLVM fstat()s fds 0-2 at startup and exits
// without a word if that fails, which the shim's plain Fd does.
class Stream extends Fd {
	constructor(private readonly onWrite?: (data: Uint8Array) => void) {
		super();
	}
	fd_fdstat_get(): any {
		const stat = new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0);
		stat.fs_rights_base = BigInt(wasi.RIGHTS_FD_WRITE) | BigInt(wasi.RIGHTS_FD_READ);
		return { ret: 0, fdstat: stat };
	}
	fd_filestat_get(): any {
		return { ret: 0, filestat: new wasi.Filestat(0n, wasi.FILETYPE_CHARACTER_DEVICE, 0n) };
	}
	fd_seek() {
		return { ret: wasi.ERRNO_SPIPE, offset: 0n };
	}
	fd_tell() {
		return { ret: wasi.ERRNO_SPIPE, offset: 0n };
	}
	fd_read() {
		return { ret: 0, data: new Uint8Array(0) };
	}
	fd_write(data: Uint8Array) {
		this.onWrite?.(data);
		return { ret: 0, nwritten: data.byteLength };
	}
}

// Collects what a stream receives, up to a limit.
function collector(limit: number) {
	const decoder = new TextDecoder();
	let text = '';
	let truncated = false;
	return {
		stream: new Stream((data) => {
			if (text.length >= limit) {
				truncated = true;
				return;
			}
			text += decoder.decode(data, { stream: true });
		}),
		text: () => (truncated ? `${text.slice(0, limit)}\n[output truncated]` : text)
	};
}

export class CppToolchain {
	private readonly root: any;
	private chain: Promise<unknown> = Promise.resolve();

	constructor(private readonly assets: CppToolchainAssets) {
		// Directory tree from the tar's paths.
		const tree = new Map<string, any>();
		for (const { path, data } of parseTar(assets.sysroot)) {
			const parts = path.split('/');
			const name = parts.pop()!;
			let dir = tree;
			for (const part of parts) {
				if (!dir.has(part)) dir.set(part, new Map());
				dir = dir.get(part);
			}
			dir.set(name, new File(data));
		}
		const toDirectory = (entries: Map<string, any>): any =>
			new Directory(
				[...entries].map(([name, node]) => [name, node instanceof Map ? toDirectory(node) : node])
			);
		this.root = new PreopenDirectory(
			'/',
			[...tree].map(([name, node]) => [name, node instanceof Map ? toDirectory(node) : node])
		);
		const bits = this.root.dir.contents.get('include')?.contents.get('bits');
		(bits ?? this.makeDir('include/bits')).contents.set(
			'stdc++.h',
			new File(new TextEncoder().encode(assets.bitsStdcpp))
		);
	}

	private makeDir(path: string): any {
		let dir = this.root.dir;
		for (const part of path.split('/')) {
			if (!dir.contents.has(part)) dir.contents.set(part, new Directory([]));
			dir = dir.contents.get(part);
		}
		return dir;
	}

	/** Compile, link and run one program. Calls are queued, because they share one file system. */
	run(source: string): Promise<CppRunResult> {
		const result = this.chain.then(() => this.runNow(source));
		this.chain = result.catch(() => undefined);
		return result;
	}

	private async runTool(module: WebAssembly.Module, args: string[]): Promise<string> {
		const log = collector(MAX_OUTPUT_CHARS);
		const fds = [new Stream(), log.stream, log.stream, this.root];
		const shim = new WASI(args, [], fds, { debug: false });
		try {
			const instance = await WebAssembly.instantiate(module, {
				wasi_snapshot_preview1: shim.wasiImport
			});
			shim.start(instance);
		} catch (e: any) {
			return `${log.text()}${e?.message ?? e}`;
		}
		return log.text();
	}

	private async runNow(source: string): Promise<CppRunResult> {
		const files = this.root.dir.contents;
		const outputOf = (name: string): Uint8Array | null => {
			const file = files.get(name);
			return file?.data?.length ? file.data : null;
		};
		files.set('main.cpp', new File(new TextEncoder().encode(source)));
		files.delete('main.o');
		files.delete('main.wasm');
		const result: CppRunResult = { output: '', error: null, compileMs: 0, linkMs: 0, runMs: 0 };

		let started = performance.now();
		const compileLog = await this.runTool(this.assets.clang, [
			'clang',
			'-cc1',
			'-triple',
			'wasm32-wasi',
			'-emit-obj',
			'-disable-free',
			'-isysroot',
			'/',
			'-resource-dir',
			RESOURCE_DIR,
			'-internal-isystem',
			'/include/c++/v1',
			'-internal-isystem',
			`${RESOURCE_DIR}/include`,
			'-internal-isystem',
			'/include/wasm32-wasi',
			'-internal-isystem',
			'/include',
			'-ferror-limit',
			'19',
			// What the clang driver passes; the frontend alone leaves it undefined.
			'-fgnuc-version=4.2.1',
			'-O2',
			'-std=gnu++20',
			'-x',
			'c++',
			'-o',
			'main.o',
			'main.cpp'
		]);
		result.compileMs = Math.round(performance.now() - started);
		if (!outputOf('main.o')) {
			result.error = compileLog.trim() || 'The C++ compiler stopped without producing a program.';
			return result;
		}

		started = performance.now();
		const linkLog = await this.runTool(this.assets.lld, [
			'wasm-ld',
			'--export-dynamic',
			'-z',
			`stack-size=${STACK_BYTES}`,
			`--max-memory=${MAX_MEMORY_BYTES}`,
			'-Llib/wasm32-wasi',
			'lib/wasm32-wasi/crt1.o',
			'main.o',
			'-lc',
			'-lc++',
			'-lc++abi',
			'-lm',
			`-L${RESOURCE_DIR.slice(1)}/lib/wasi`,
			'-lclang_rt.builtins-wasm32',
			'-o',
			'main.wasm'
		]);
		result.linkMs = Math.round(performance.now() - started);
		const program = outputOf('main.wasm');
		if (!program) {
			result.error = linkLog.trim() || 'The linker stopped without producing a program.';
			return result;
		}

		started = performance.now();
		const stdout = collector(MAX_OUTPUT_CHARS);
		const stderr = collector(MAX_OUTPUT_CHARS);
		const shim = new WASI(
			['prog'],
			[],
			[new Stream(), stdout.stream, stderr.stream, new PreopenDirectory('/sandbox', [])],
			{ debug: false }
		);
		let exitCode: number;
		let crash = '';
		try {
			const { instance } = await WebAssembly.instantiate(program.slice().buffer, {
				wasi_snapshot_preview1: shim.wasiImport
			});
			exitCode = shim.start(instance);
		} catch (e: any) {
			exitCode = -1;
			crash = String(e?.message ?? e);
		}
		result.runMs = Math.round(performance.now() - started);
		result.output = stdout.text();
		if (exitCode !== 0) {
			const message = (stderr.text() + crash).trim();
			result.error = message || `Program exited with code ${exitCode}`;
		}
		return result;
	}
}
