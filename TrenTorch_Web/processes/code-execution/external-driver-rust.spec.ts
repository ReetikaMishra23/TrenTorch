// Runs the Rust driver with the real rustc.wasm (see rust-toolchain.ts), on hand-written solutions. Slow:
// the compiler is 88 MB of WebAssembly.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { RustToolchain, parseBundle } from './rust-toolchain';
import { buildRustDriver } from './external-driver-rust';
import { answer, call, fn, runTypedPlan } from './typed-testkit';
import type { ExternalCall, ExternalFunction } from './external-protocol';
import { buildLanguageStarters } from '../ide-content/build-language-starters';

const asset = (name: string) =>
	gunzipSync(readFileSync(new URL(`../../platform/static/rust-runtime/${name}`, import.meta.url)));

let toolchain: RustToolchain;
beforeAll(async () => {
	toolchain = new RustToolchain({
		rustc: await WebAssembly.compile(asset('rustc.wasm.gz')),
		sysroot: parseBundle(new Uint8Array(asset('sysroot-wasip1.bundle.gz')))
	});
}, 180_000);

function run(source: string, f: ExternalFunction, calls: ExternalCall[]) {
	return runTypedPlan({
		language: 'rust',
		source,
		function: f,
		calls,
		buildDriver: (src, plan, code) => buildRustDriver(src, plan.function, code),
		executor: {
			async execute(driver, input, hooks) {
				const result = await toolchain.run(driver, {
					inputs: { 'calls.txt': input },
					onStdout: hooks.onText,
					onStart: hooks.started
				});
				return result.built
					? { crash: result.crashed ? (result.error ?? 'crashed') : undefined }
					: { buildError: result.error ?? 'did not build' };
			}
		}
	});
}

const list = (values: number[]) => ({ values, cycle: -1, join: null });
const NODES = `#[derive(Debug)]
struct ListNode { val: i64, next: Option<Box<ListNode>> }
#[derive(Debug)]
struct TreeNode { val: i64, left: Option<Box<TreeNode>>, right: Option<Box<TreeNode>> }
`;

describe('Rust driver', () => {
	it('two sum, from the starter, with the student printing alongside', async () => {
		const starter = buildLanguageStarters({
			name: 'two_sum',
			params: [
				{ name: 'nums', type: 'list[int]' },
				{ name: 'target', type: 'int' }
			],
			returns: 'list[int]',
			example: { nums: [2, 7], target: 9 }
		} as never).rust;
		const source = starter.replace(
			/fn two_sum\([\s\S]*?\n\}/,
			`fn two_sum(nums: Vec<i64>, target: i64) -> Vec<i64> {
    println!("searching {}", nums.len());
    let mut seen = std::collections::HashMap::new();
    for (i, v) in nums.iter().enumerate() {
        if let Some(j) = seen.get(&(target - v)) { return vec![*j as i64, i as i64]; }
        seen.insert(*v, i);
    }
    vec![]
}`
		);
		const f = fn(
			'two_sum',
			[
				['nums', 'list[int]'],
				['target', 'int']
			],
			'list[int]'
		);
		const r = await run(source, f, [
			call([[2, 7, 11, 15], 9]),
			call([[3, 3], 6]),
			call([[1, 2], 99]),
			call([[], 0])
		]);
		expect(r.failed).toBeUndefined();
		expect(r.list.map(answer)).toEqual([[0, 1], [0, 1], [], []]);
		expect(r.printed).toBe('searching 4\nsearching 2\nsearching 2\nsearching 0\n');
	}, 240_000);

	it('strings, bools, floats, big ints, grids and lists of strings', async () => {
		const pal = await run(
			'fn is_pal(s: String) -> bool { let t: String = s.chars().rev().collect(); t == s }\nfn main() {}\n',
			fn('is_pal', [['s', 'str']], 'bool'),
			[call(['aba']), call(['ab']), call(['']), call(['a b%é'])]
		);
		expect(pal.failed).toBeUndefined();
		expect(pal.list.map(answer)).toEqual([true, false, true, false]);

		const mix = await run(
			`fn half(n: i64) -> f64 { n as f64 / 2.0 }
fn dbl(n: i64) -> i64 { n * 2 }
fn f(g: Vec<Vec<i64>>, w: Vec<String>) -> Vec<Vec<i64>> { let mut g = g; for s in w { g.push(vec![s.len() as i64]); } g }
fn main() {}`,
			fn('half', [['n', 'int']], 'float'),
			[call([3]), call([-1]), call([0])]
		);
		expect(mix.list.map(answer)).toEqual([1.5, -0.5, 0]);

		const big = await run(
			'fn dbl(n: i64) -> i64 { n * 2 }\nfn main() {}',
			fn('dbl', [['n', 'int']], 'int'),
			[call([{ $int: '4611686018427387000' }])]
		);
		expect((big.list[0] as { outJson: string }).outJson).toBe('9223372036854774000');

		const grid = await run(
			'fn f(g: Vec<Vec<i64>>, w: Vec<String>) -> Vec<Vec<i64>> { let mut g = g; for s in w { g.push(vec![s.len() as i64]); } g }\nfn main() {}',
			fn(
				'f',
				[
					['g', 'list[list[int]]'],
					['w', 'list[str]']
				],
				'list[list[int]]'
			),
			[
				call([
					[[1, 2], [3]],
					['ab', 'c d']
				]),
				call([[], []])
			]
		);
		expect(grid.list.map(answer)).toEqual([[[1, 2], [3], [2], [3]], []]);
	}, 240_000);

	it('linked lists and trees', async () => {
		const rev = await run(
			`${NODES}fn reverse_list(head: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
    let mut prev = None;
    let mut cur = head;
    while let Some(mut n) = cur { cur = n.next.take(); n.next = prev; prev = Some(n); }
    prev
}
fn main() {}`,
			fn('reverse_list', [['head', 'ListNode']], 'ListNode'),
			[call([list([1, 2, 3])]), call([list([])]), call([list([5])])]
		);
		expect(rev.failed).toBeUndefined();
		expect(rev.list.map(answer)).toEqual([[3, 2, 1], [], [5]]);

		const inv = await run(
			`${NODES}fn invert_tree(root: Option<Box<TreeNode>>) -> Option<Box<TreeNode>> {
    match root { None => None, Some(mut n) => { let l = invert_tree(n.left.take()); let r = invert_tree(n.right.take()); n.left = r; n.right = l; Some(n) } }
}
fn main() {}`,
			fn('invert_tree', [['root', 'TreeNode']], 'TreeNode'),
			[call([[1, 2, 3, 4, null, null, 5]]), call([[]]), call([[1, null, 2]]), call([[-1]])]
		);
		expect(inv.list.map(answer)).toEqual([[1, 3, 2, 5, null, null, 4], [], [1, 2], [-1]]);
	}, 240_000);

	it('skips performance calls after a slow one; a panic ends the run but keeps earlier answers', async () => {
		const f = fn('spin', [['n', 'int']], 'int');
		const slow = await run(
			'fn spin(n: i64) -> i64 { let mut x: i64 = 0; let mut i = 0; while i < n { x = x.wrapping_add(std::hint::black_box(i)); i += 1; } x }\nfn main() {}',
			f,
			[
				call([300000000], { case: 'p1', perf: true, limitMs: 5 }),
				call([1], { case: 'p2', perf: true, limitMs: 5 }),
				call([1], { case: 'o', limitMs: 5 })
			]
		);
		expect((slow.list[0] as { ms: number }).ms).toBeGreaterThan(5);
		expect(slow.list[1]).toEqual({ skip: true });
		expect(answer(slow.list[2])).toBe(0);

		const crash = await run(
			'fn f(n: i64) -> i64 { if n == 2 { panic!("boom {}", n); } n }\nfn main() {}',
			fn('f', [['n', 'int']], 'int'),
			[call([1]), call([2]), call([3])]
		);
		expect(answer(crash.list[0])).toBe(1);
		expect(crash.list[1]).toBeUndefined();
		expect(crash.crash).toMatch(/boom 2/);
	}, 240_000);

	it('reports a compile error', async () => {
		const r = await run(
			'fn f(n: i64) -> i64 { n + }\nfn main() {}',
			fn('f', [['n', 'int']], 'int'),
			[call([1])]
		);
		expect(r.failed).toMatch(/error/);
	}, 240_000);
});
