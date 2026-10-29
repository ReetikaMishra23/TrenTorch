// Runs the Go driver in the real Yaegi interpreter (see go-yaegi-node.ts), on hand-written solutions.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadYaegi } from './go-yaegi-node';
import { buildGoDriver } from './external-driver-go';
import { encodeCalls } from './external-codec';
import { answer, call, fn, runTypedPlan } from './typed-testkit';
import type { ExternalCall, ExternalFunction } from './external-protocol';
import { buildLanguageStarters } from '../ide-content/build-language-starters';

let runGo: Awaited<ReturnType<typeof loadYaegi>>;
beforeAll(async () => {
	runGo = await loadYaegi();
}, 60_000);

function run(source: string, f: ExternalFunction, calls: ExternalCall[], chunkByCase = true) {
	return runTypedPlan({
		language: 'go',
		source,
		function: f,
		calls,
		chunkByCase,
		buildDriver: (src, plan, code) =>
			buildGoDriver(src, plan.function, code, encodeCalls(plan.function, plan.calls)),
		executor: {
			async execute(driver, _input, hooks) {
				hooks.started();
				const result = await runGo(driver);
				hooks.onText(result.output);
				// Yaegi runs main() while evaluating, so the later "main.main" lookup always complains.
				const error =
					result.error && !/undefined selector: main\b/.test(result.error) ? result.error : null;
				return error && !result.output.includes('TT')
					? { buildError: error }
					: { crash: error ?? undefined };
			}
		}
	});
}

const list = (values: number[]) => ({ values, cycle: -1, join: null });

describe('Go driver', () => {
	it('two sum, with the student printing alongside', async () => {
		const f = fn(
			'twoSum',
			[
				['nums', 'list[int]'],
				['target', 'int']
			],
			'list[int]'
		);
		const source = `package main

import "fmt"

func twoSum(nums []int, target int) []int {
	fmt.Println("searching", len(nums))
	seen := map[int]int{}
	for i, v := range nums {
		if j, ok := seen[target-v]; ok {
			return []int{j, i}
		}
		seen[v] = i
	}
	return []int{}
}

func main() { fmt.Println(twoSum([]int{2, 7}, 9)) }
`;
		const r = await run(source, f, [
			call([[2, 7, 11, 15], 9], { case: 'a' }),
			call([[3, 3], 6], { case: 'b' }),
			call([[1, 2], 99], { case: 'c' }),
			call([[], 0], { case: 'd' })
		]);
		expect(r.failed).toBeUndefined();
		expect(r.list.map(answer)).toEqual([[0, 1], [0, 1], [], []]);
		expect(r.printed).toBe('searching 4\nsearching 2\nsearching 2\nsearching 0\n');
	}, 60_000);

	it('strings, bools, floats and negatives, from the starter', async () => {
		const starter = buildLanguageStarters({
			name: 'isPal',
			params: [{ name: 's', type: 'str' }],
			returns: 'bool',
			example: { s: 'aba' }
		} as never).go;
		const source = starter.replace(
			'return false',
			'for i := 0; i < len(s)/2; i++ {\n\t\tif s[i] != s[len(s)-1-i] {\n\t\t\treturn false\n\t\t}\n\t}\n\treturn true'
		);
		const f = fn('isPal', [['s', 'str']], 'bool');
		const r = await run(source, f, [
			call(['aba'], { case: 'a' }),
			call(['ab'], { case: 'b' }),
			call([''], { case: 'c' }),
			call(['a b%é'], { case: 'd' })
		]);
		expect(r.failed).toBeUndefined();
		expect(r.list.map(answer)).toEqual([true, false, true, false]);

		const h = fn('half', [['n', 'int']], 'float');
		const half = await run(
			'package main\nfunc half(n int) float64 { return float64(n) / 2 }\n',
			h,
			[call([3], { case: 'a' }), call([-1], { case: 'b' }), call([0], { case: 'c' })]
		);
		expect(half.list.map(answer)).toEqual([1.5, -0.5, 0]);

		const big = await run(
			'package main\nfunc dbl(n int) int { return n * 2 }\n',
			fn('dbl', [['n', 'int']], 'int'),
			[call([{ $int: '4611686018427387000' }], { case: 'a' })]
		);
		expect((big.list[0] as { outJson: string }).outJson).toBe('9223372036854774000');
	}, 60_000);

	it('linked lists: build, cycle, join, and a returned loop', async () => {
		const rev = fn('reverseList', [['head', 'ListNode']], 'ListNode');
		const starter = buildLanguageStarters({
			name: 'reverseList',
			params: [{ name: 'head', type: 'ListNode' }],
			returns: 'ListNode'
		} as never).go;
		const solve = starter.replace(
			/func reverseList\(head \*ListNode\) \*ListNode \{[\s\S]*?\n\}/,
			'func reverseList(head *ListNode) *ListNode {\n\tvar prev *ListNode\n\tfor head != nil {\n\t\tn := head.Next\n\t\thead.Next = prev\n\t\tprev = head\n\t\thead = n\n\t}\n\treturn prev\n}'
		);
		const r = await run(solve, rev, [
			call([list([1, 2, 3])], { case: 'a' }),
			call([list([])], { case: 'b' }),
			call([list([5])], { case: 'c' })
		]);
		expect(r.failed).toBeUndefined();
		expect(r.list.map(answer)).toEqual([[3, 2, 1], [], [5]]);

		const loop = await run(
			solve.replace(
				'var prev *ListNode',
				'var prev *ListNode\n\tif head != nil && head.Next != nil {\n\t\thead.Next.Next = head\n\t\treturn head\n\t}'
			),
			rev,
			[call([list([1, 2])], { case: 'a' })]
		);
		expect((loop.list[0] as { error: string }).error).toMatch(/loops back on itself/);

		const nodeType = 'package main\ntype ListNode struct {\n\tVal  int\n\tNext *ListNode\n}\n';
		const has = await run(
			`${nodeType}func hasCycle(h *ListNode) bool {\n\ts := map[*ListNode]bool{}\n\tfor h != nil {\n\t\tif s[h] {\n\t\t\treturn true\n\t\t}\n\t\ts[h] = true\n\t\th = h.Next\n\t}\n\treturn false\n}\n`,
			fn('hasCycle', [['head', 'ListNode']], 'bool'),
			[
				call([{ values: [1, 2, 3], cycle: 1, join: null }], { case: 'a' }),
				call([list([1, 2, 3])], { case: 'b' })
			]
		);
		expect(has.list.map(answer)).toEqual([true, false]);

		const meet = await run(
			`${nodeType}func meet(a, b *ListNode) int {\n\ts := map[*ListNode]bool{}\n\tfor n := a; n != nil; n = n.Next {\n\t\ts[n] = true\n\t}\n\ti := 0\n\tfor n := b; n != nil; n = n.Next {\n\t\tif s[n] {\n\t\t\treturn i\n\t\t}\n\t\ti++\n\t}\n\treturn -1\n}\n`,
			fn(
				'meet',
				[
					['a', 'ListNode'],
					['b', 'ListNode']
				],
				'int'
			),
			[
				call([list([1, 2, 3]), { values: [9, 8], cycle: -1, join: { param: 'a', index: 1 } }], {
					case: 'a'
				}),
				call([list([1]), list([2])], { case: 'b' })
			]
		);
		expect(meet.list.map(answer)).toEqual([2, -1]);
	}, 60_000);

	it('trees: level order with holes in, and out', async () => {
		const f = fn('invertTree', [['root', 'TreeNode']], 'TreeNode');
		const head =
			'package main\ntype TreeNode struct {\n\tVal         int\n\tLeft, Right *TreeNode\n}\n';
		const source = `${head}func invertTree(r *TreeNode) *TreeNode {\n\tif r == nil {\n\t\treturn nil\n\t}\n\tl := invertTree(r.Left)\n\tr.Left = invertTree(r.Right)\n\tr.Right = l\n\treturn r\n}\n`;
		const r = await run(source, f, [
			call([[1, 2, 3, 4, null, null, 5]], { case: 'a' }),
			call([[]], { case: 'b' }),
			call([[1, null, 2]], { case: 'c' }),
			call([[-1]], { case: 'd' })
		]);
		expect(r.list.map(answer)).toEqual([[1, 3, 2, 5, null, null, 4], [], [1, 2], [-1]]);
		const shared = await run(
			`${head}func invertTree(r *TreeNode) *TreeNode {\n\tif r != nil {\n\t\tr.Right = r.Left\n\t}\n\treturn r\n}\n`,
			f,
			[call([[1, 2]], { case: 'a' })]
		);
		expect((shared.list[0] as { error: string }).error).toMatch(/same node appears twice/);
	}, 60_000);

	it('grids and lists of strings', async () => {
		const f = fn(
			'f',
			[
				['g', 'list[list[int]]'],
				['w', 'list[str]']
			],
			'list[list[int]]'
		);
		const r = await run(
			'package main\nfunc f(g [][]int, w []string) [][]int {\n\tfor _, s := range w {\n\t\tg = append(g, []int{len(s)})\n\t}\n\treturn g\n}\n',
			f,
			[
				call(
					[
						[[1, 2], [3]],
						['ab', 'c d']
					],
					{ case: 'a' }
				),
				call([[], []], { case: 'b' })
			]
		);
		expect(r.list.map(answer)).toEqual([[[1, 2], [3], [2], [3]], []]);
	}, 60_000);

	it("a panic is that call's error and the other calls still run", async () => {
		const f = fn('f', [['n', 'int']], 'int');
		const source = 'package main\nfunc f(n int) int {\n\tvar a []int\n\treturn a[n]\n}\n';
		const r = await run(source, f, [call([1], { case: 'a' }), call([2], { case: 'b' })]);
		expect((r.list[0] as { error: string }).error).toMatch(/index out of range|out of range/);
		expect((r.list[1] as { error: string }).error).toBeTruthy();
	}, 60_000);

	it('skips performance tests after a slow one, and keeps test order', async () => {
		const f = fn('spin', [['n', 'int']], 'int');
		const source =
			'package main\nfunc spin(n int) int {\n\tx := 0\n\tfor i := 0; i < n; i++ {\n\t\tx += i\n\t}\n\treturn x\n}\n';
		const r = await run(source, f, [
			call([2000000], { case: 'p1', perf: true, limitMs: 5 }),
			call([1], { case: 'p2', perf: true, limitMs: 5 }),
			call([1], { case: 'o', perf: false, limitMs: 5 })
		]);
		expect((r.list[0] as { ms: number }).ms).toBeGreaterThan(5);
		expect(r.list[1]).toEqual({ skip: true });
		expect(answer(r.list[2])).toBe(0);
	}, 60_000);

	it('reports a compile error', async () => {
		const r = await run(
			'package main\nfunc f(n int) int { return n + }\n',
			fn('f', [['n', 'int']], 'int'),
			[call([1], { case: 'a' })]
		);
		expect(r.failed).toBeTruthy();
	}, 60_000);

	it('keeps working through hundreds of evaluations, a compile panic and what follows it', async () => {
		const f = fn('f', [['n', 'int']], 'int');
		const source = 'package main\nfunc f(n int) int { return n + 1 }\n';
		for (let i = 0; i < 150; i++) {
			const r = await run(source, f, [call([i], { case: 'a' }), call([i], { case: 'b' })]);
			expect(r.list.map(answer), `round ${i}`).toEqual([i + 1, i + 1]);
		}
		const bad = await run(
			'package main\nfunc f(n int) int { return []int{undefinedThing}[0] }\n',
			f,
			[call([1], { case: 'a' })]
		);
		expect(bad.failed).toMatch(/undefinedThing/);
		const after = await run(source, f, [call([5], { case: 'a' })]);
		expect(answer(after.list[0])).toBe(6);
	}, 120_000);
});
