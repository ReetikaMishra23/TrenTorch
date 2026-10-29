import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, it, expect, beforeAll } from 'vitest';
import { curriculum as generated } from 'virtual:curriculum/bundle';
import { buildTestHarness } from '$processes/ide-content/build-test-harness';
import type { GeneratedQuestion } from '$processes/ide-content/curriculum-index';
import { buildLanguageStarters } from '$processes/ide-content/build-language-starters';
import { CppToolchain } from '$processes/code-execution/cpp-toolchain';
import bitsStdcpp from '$processes/code-execution/cpp-bits-stdcpp.h?raw';
import { RustToolchain, parseBundle } from '$processes/code-execution/rust-toolchain';
import { loadYaegi } from '$processes/code-execution/go-yaegi-node';
import { buildCppDriver } from '$processes/code-execution/external-driver-cpp';
import { buildGoDriver } from '$processes/code-execution/external-driver-go';
import { buildRustDriver } from '$processes/code-execution/external-driver-rust';
import { encodeCalls, unsupportedReason } from '$processes/code-execution/external-codec';
import { runTypedPlan } from '$processes/code-execution/typed-testkit';
import type { TypedExecutor } from '$processes/code-execution/typed-run';
import type { ExternalCall } from '$processes/code-execution/external-protocol';
import { startPyodide, prepare } from './external-kit';

// Every question's real inputs through the C++, Go and Rust drivers. The student's function is the starter
// (it returns an empty value), so this proves what no hand-written solution can: that each question's
// signature compiles with the driver, and that every input it makes is read without a hiccup and the
// answer is written back in a form the judge can read. (Java needs CheerpJ, so it is only run in a browser.)
//
// C++ and Rust compile once per distinct signature; Go runs every question.

const questions = (
	generated.roots.flatMap((root) =>
		root.sections.flatMap((section) => section.tracks.flatMap((track) => track.questions))
	) as GeneratedQuestion[]
).filter((q) => q.kind === 'dsa' && q.signature);
const only = process.env.PYODIDE_ONLY?.split(',').filter(Boolean);
const picked = questions.filter((q) => !only || only.includes(q.id));

const signatureKey = (q: GeneratedQuestion) =>
	JSON.stringify([q.signature!.params.map((p) => p.type), q.signature!.returns]);

/** Some of the question's calls: the first few, and the one with the most data. */
function sample(calls: ExternalCall[], withBiggest = true): ExternalCall[] {
	const size = (c: ExternalCall) => JSON.stringify(c.args).length;
	const biggest = calls.reduce((a, b) => (size(b) > size(a) ? b : a));
	return withBiggest ? [...new Set([...calls.slice(0, 6), biggest])] : calls.slice(0, 6);
}

const asset = (dir: string, name: string) =>
	gunzipSync(readFileSync(new URL(`../platform/static/${dir}/${name}`, import.meta.url)));

describe('typed drivers on every question', () => {
	let cpp: CppToolchain;
	let rust: RustToolchain;
	let runGo: Awaited<ReturnType<typeof loadYaegi>>;
	beforeAll(async () => {
		await startPyodide();
		runGo = await loadYaegi();
		cpp = new CppToolchain({
			clang: await WebAssembly.compile(asset('cpp-runtime', 'clang.wasm.gz')),
			lld: await WebAssembly.compile(asset('cpp-runtime', 'lld.wasm.gz')),
			sysroot: new Uint8Array(asset('cpp-runtime', 'sysroot.tar.gz')),
			bitsStdcpp
		});
		rust = new RustToolchain({
			rustc: await WebAssembly.compile(asset('rust-runtime', 'rustc.wasm.gz')),
			sysroot: parseBundle(new Uint8Array(asset('rust-runtime', 'sysroot-wasip1.bundle.gz')))
		});
	}, 300_000);

	it('finds the questions', () => {
		expect(questions.length).toBeGreaterThan(300);
	});

	const checked = { cpp: new Set<string>(), rust: new Set<string>() };

	it.each(picked.map((q) => [q.id, q] as const))(
		'%s',
		async (_id, question) => {
			const harness = buildTestHarness(question);
			const plan = await prepare(harness);
			const calls = sample(plan.calls);
			const starters = buildLanguageStarters(question.signature!);
			// A type only Python and JavaScript have: every call is reported as not runnable.
			const typed = unsupportedReason(plan.function) === null;
			const hasNodes = plan.function.params.some((p) => /Node/.test(p.type));

			const check = (outcome: Awaited<ReturnType<typeof runTypedPlan>>, language: string) => {
				expect(outcome.failed, `${language} did not build: ${outcome.failed}`).toBeUndefined();
				expect(outcome.crash, `${language} crashed`).toBeUndefined();
				for (const [i, record] of outcome.list.entries()) {
					expect(record, `${language} call ${i} has no record`).toBeDefined();
					if ('unsupported' in record!) continue;
					expect(
						record,
						`${language} call ${i}: ${JSON.stringify(record).slice(0, 200)}`
					).toHaveProperty('outJson');
				}
			};

			// Go: every question.
			const goExecutor: TypedExecutor = {
				async execute(driver, _input, hooks) {
					hooks.started();
					const result = await runGo(driver);
					hooks.onText(result.output);
					const error =
						result.error && !/undefined selector: main\b/.test(result.error) ? result.error : null;
					return error ? { buildError: error } : {};
				}
			};
			const go = await runTypedPlan({
				language: 'go',
				source: starters.go,
				function: plan.function,
				calls,
				chunkByCase: true,
				buildDriver: (src, p, code) =>
					buildGoDriver(src, p.function, code, encodeCalls(p.function, p.calls)),
				executor: goExecutor
			});
			if (typed) check(go, 'go');

			// C++ and Rust: once per distinct signature.
			const key = signatureKey(question);
			if (typed && !checked.cpp.has(key)) {
				checked.cpp.add(key);
				const outcome = await runTypedPlan({
					language: 'cpp',
					source: starters.cpp,
					function: plan.function,
					calls,
					buildDriver: (src, p, code) => buildCppDriver(src, p.function, code),
					executor: {
						async execute(driver, input, hooks) {
							const r = await cpp.run(driver, {
								inputs: { 'calls.txt': input },
								onStdout: hooks.onText,
								onStart: hooks.started
							});
							return r.built
								? { crash: r.error ?? undefined }
								: { buildError: r.error ?? 'did not build' };
						}
					}
				});
				check(outcome, 'cpp');
			}
			if (typed && !checked.rust.has(key)) {
				checked.rust.add(key);
				const outcome = await runTypedPlan({
					language: 'rust',
					source: starters.rust,
					function: plan.function,
					// The starter's stub drops its argument, and dropping a list of 100,000 boxed nodes is recursive: it
					// overflows the browser's small stack, for any solution that does the same. Not the driver's doing.
					calls: hasNodes ? sample(plan.calls, false) : calls,
					buildDriver: (src, p, code) => buildRustDriver(src, p.function, code),
					executor: {
						async execute(driver, input, hooks) {
							const r = await rust.run(driver, {
								inputs: { 'calls.txt': input },
								onStdout: hooks.onText,
								onStart: hooks.started
							});
							return r.built
								? { crash: r.crashed ? (r.error ?? 'crashed') : undefined }
								: { buildError: r.error ?? 'did not build' };
						}
					}
				});
				check(outcome, 'rust');
			}
		},
		300_000
	);
});
