import { describe, it, expect } from 'vitest';
import { runJsCalls } from './run-js-calls';
import type { ExternalCall, ExternalPlan, ExternalRecord } from './external-protocol';

function plan(
	fn: { name: string; params: { name: string; type: string }[]; returns: string },
	calls: Partial<ExternalCall>[]
): ExternalPlan {
	return {
		function: fn,
		compare: 'exact',
		calls: calls.map((c, i) => ({
			key: `c${i}:0`,
			case: `c${i}`,
			index: 0,
			args: [],
			limitMs: 1000,
			perf: false,
			reads: false,
			batch: false,
			...c
		}))
	};
}

function run(source: string, p: ExternalPlan, clock?: () => number) {
	const records: Record<string, ExternalRecord> = {};
	const logs: unknown[][] = [];
	runJsCalls({
		source,
		plan: p,
		now: clock ?? (() => performance.now()),
		log: (...a) => logs.push(a),
		emit: (k, r) => (records[k] = r)
	});
	return { records, logs };
}

const sum = {
	name: 'add',
	params: [
		{ name: 'a', type: 'int' },
		{ name: 'b', type: 'int' }
	],
	returns: 'int'
};

describe('runJsCalls', () => {
	it('calls the function with the arguments in order and reports answer, time and no reads', () => {
		const { records } = run('function add(a, b) { return a + b; }', plan(sum, [{ args: [2, 3] }]));
		expect(records['c0:0']).toMatchObject({ out: 5, reads: null });
		expect((records['c0:0'] as { ms: number }).ms).toBeGreaterThanOrEqual(0);
	});

	it('looks for the function by its JavaScript spelling', () => {
		const snake = {
			name: 'two_sum',
			params: [{ name: 'a_value', type: 'int' }],
			returns: 'int'
		};
		const { records } = run(
			'function twoSum(aValue) { return aValue + 1; }',
			plan(snake, [{ args: [1] }])
		);
		expect(records['c0:0']).toMatchObject({ out: 2 });
	});

	it('finds const, let and arrow functions as well as declarations', () => {
		for (const src of [
			'const add = (a, b) => a + b;',
			'let add = function (a, b) { return a + b; };',
			'var add = (a, b) => a + b;'
		]) {
			expect(run(src, plan(sum, [{ args: [1, 1] }])).records['c0:0']).toMatchObject({ out: 2 });
		}
	});

	it('says so when the function is missing, for every call', () => {
		const { records } = run('const other = 1;', plan(sum, [{ args: [1, 1] }, { args: [2, 2] }]));
		expect(records['c0:0']).toEqual({ error: 'Your code does not define a function named add.' });
		expect(records['c1:0']).toEqual(records['c0:0']);
	});

	it('reports a syntax error and a top-level throw as errors, not as a crash', () => {
		expect(
			(run('function add( {', plan(sum, [{ args: [1, 1] }])).records['c0:0'] as { error: string })
				.error
		).toMatch(/Unexpected|expected/i);
		expect(
			(
				run('throw new Error("boom");', plan(sum, [{ args: [1, 1] }])).records['c0:0'] as {
					error: string;
				}
			).error
		).toMatch(/boom/);
	});

	it('reports a throw inside the function against that call only', () => {
		const { records } = run(
			'function add(a, b) { if (a === 0) throw new RangeError("zero"); return a + b; }',
			plan(sum, [{ args: [0, 1] }, { args: [1, 1] }])
		);
		expect(records['c0:0']).toEqual({ error: 'RangeError: zero' });
		expect(records['c1:0']).toMatchObject({ out: 2 });
	});

	it('rejects undefined and promises instead of calling them an answer', () => {
		expect(run('function add(a, b) { }', plan(sum, [{ args: [1, 1] }])).records['c0:0']).toEqual({
			error: 'Your function returned undefined. Return the answer.'
		});
		expect(
			run('async function add(a, b) { return 1; }', plan(sum, [{ args: [1, 1] }])).records['c0:0']
		).toEqual({ error: 'Your function returned a Promise. Return the answer directly.' });
	});

	it('keeps console output out of the answers', () => {
		const { records, logs } = run(
			'function add(a, b) { console.log("hi", a); return a + b; }',
			plan(sum, [{ args: [1, 2] }])
		);
		expect(logs).toEqual([['hi', 1]]);
		expect(records['c0:0']).toMatchObject({ out: 3 });
	});

	it('does not let the function change the plan: each call gets its own copy', () => {
		const p = plan({ name: 'f', params: [{ name: 'xs', type: 'list[int]' }], returns: 'int' }, [
			{ args: [[3, 1, 2]] },
			{ args: [[3, 1, 2]] }
		]);
		const { records } = run('function f(xs) { xs.sort(); return xs[0]; }', p);
		expect(records['c0:0']).toMatchObject({ out: 1 });
		expect(p.calls[0].args).toEqual([[3, 1, 2]]);
	});

	describe('linked lists', () => {
		const reverse = {
			name: 'reverse',
			params: [{ name: 'head', type: 'ListNode' }],
			returns: 'ListNode'
		};
		const src = `function reverse(head) { let prev = null; while (head) { const n = head.next; head.next = prev; prev = head; head = n; } return prev; }`;
		const list = (values: number[], cycle = -1) => ({ values, cycle, join: null });

		it('builds the list, and reads the returned list back as values', () => {
			const { records } = run(
				src,
				plan(reverse, [{ args: [list([1, 2, 3])] }, { args: [list([])] }])
			);
			expect(records['c0:0']).toMatchObject({ out: [3, 2, 1] });
			expect(records['c1:0']).toMatchObject({ out: [] });
		});

		it('builds a cycle where the plan says, and stops a returned loop', () => {
			const detect = {
				name: 'hasCycle',
				params: [{ name: 'head', type: 'ListNode' }],
				returns: 'bool'
			};
			const s = `function hasCycle(h) { const seen = new Set(); while (h) { if (seen.has(h)) return true; seen.add(h); h = h.next; } return false; }`;
			const { records } = run(
				s,
				plan(detect, [{ args: [list([1, 2, 3], 1)] }, { args: [list([1, 2, 3])] }])
			);
			expect(records['c0:0']).toMatchObject({ out: true });
			expect(records['c1:0']).toMatchObject({ out: false });

			const loop = run(
				'function reverse(h) { h.next.next = h; return h; }',
				plan(reverse, [{ args: [list([1, 2])] }])
			);
			expect((loop.records['c0:0'] as { error: string }).error).toMatch(/loops back on itself/);
		});

		it('joins two lists at the node the plan names', () => {
			const inter = {
				name: 'meet',
				params: [
					{ name: 'a', type: 'ListNode' },
					{ name: 'b', type: 'ListNode' }
				],
				returns: 'ListNodeRef'
			};
			const s = `function meet(a, b) { const seen = new Set(); for (let n = a; n; n = n.next) seen.add(n); for (let n = b; n; n = n.next) if (seen.has(n)) return n; return null; }`;
			const joined = { values: [9, 8], cycle: -1, join: { param: 'a', index: 1 } };
			const { records } = run(
				s,
				plan(inter, [{ args: [list([1, 2, 3]), joined] }, { args: [list([1]), list([2])] }])
			);
			expect(records['c0:0']).toMatchObject({ out: 1 });
			expect(records['c1:0']).toMatchObject({ out: -1 });
		});

		it('refuses a node that was not in the list', () => {
			const inter = {
				name: 'meet',
				params: [{ name: 'a', type: 'ListNode' }],
				returns: 'ListNodeRef'
			};
			const { records } = run(
				'function meet(a) { return new ListNode(5); }',
				plan(inter, [{ args: [list([1])] }])
			);
			expect((records['c0:0'] as { error: string }).error).toMatch(/not a node of the list/);
		});

		it('uses the ListNode class the student wrote', () => {
			const { records } = run(
				`class ListNode { constructor(val, next) { this.val = val * 10; this.next = next; } }
				 function reverse(head) { return head; }`,
				plan(reverse, [{ args: [list([1, 2])] }])
			);
			expect(records['c0:0']).toMatchObject({ out: [10, 20] });
		});
	});

	it('runs a starter that declares its own ListNode and TreeNode classes', () => {
		const src = `class ListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } }
class TreeNode { constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; } }
function depth(root) { return root ? 1 + Math.max(depth(root.left), depth(root.right)) : 0; }`;
		const d = { name: 'depth', params: [{ name: 'root', type: 'TreeNode' }], returns: 'int' };
		expect(run(src, plan(d, [{ args: [[1, 2, 3, 4]] }])).records['c0:0']).toMatchObject({ out: 3 });
	});

	describe('trees', () => {
		const invert = {
			name: 'invert',
			params: [{ name: 'root', type: 'TreeNode' }],
			returns: 'TreeNode'
		};
		const src = `function invert(r) { if (!r) return null; [r.left, r.right] = [invert(r.right), invert(r.left)]; return r; }`;

		it('round-trips level order with holes, and trims trailing nulls', () => {
			const { records } = run(
				src,
				plan(invert, [
					{ args: [[1, 2, 3, 4, null, null, 5]] },
					{ args: [[]] },
					{ args: [[1, null, 2]] }
				])
			);
			expect(records['c0:0']).toMatchObject({ out: [1, 3, 2, 5, null, null, 4] });
			expect(records['c1:0']).toMatchObject({ out: [] });
			expect(records['c2:0']).toMatchObject({ out: [1, 2] });
		});

		it('returns the value of a TreeNodeVal answer, or null', () => {
			const lca = {
				name: 'f',
				params: [{ name: 'root', type: 'TreeNode' }],
				returns: 'TreeNodeVal'
			};
			const { records } = run(
				'function f(r) { return r && r.left; }',
				plan(lca, [{ args: [[1, 2]] }, { args: [[1]] }, { args: [[]] }])
			);
			expect(records['c0:0']).toMatchObject({ out: 2 });
			expect(records['c1:0']).toMatchObject({ out: null });
			expect(records['c2:0']).toMatchObject({ out: null });
		});

		it('refuses a tree that shares a node', () => {
			const { records } = run(
				'function invert(r) { r.right = r.left; return r; }',
				plan(invert, [{ args: [[1, 2]] }])
			);
			expect((records['c0:0'] as { error: string }).error).toMatch(/same node appears twice/);
		});
	});

	describe('reads', () => {
		const find = {
			name: 'find',
			params: [
				{ name: 'xs', type: 'list[int]' },
				{ name: 't', type: 'int' }
			],
			returns: 'int'
		};
		const xs = Array.from({ length: 1000 }, (_, i) => i * 2);
		const binary = `function find(xs, t) { let lo = 0, hi = xs.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (xs[m] === t) return m; if (xs[m] < t) lo = m + 1; else hi = m - 1; } return -1; }`;
		const scan = `function find(xs, t) { for (const x of xs) { if (x === t) return 1; } return -1; }`;

		it('counts index reads and iteration, and only when the case asks', () => {
			const { records } = run(binary, plan(find, [{ args: [xs, 700], reads: true }]));
			const r = records['c0:0'] as { reads: number };
			expect(r.reads).toBeGreaterThan(0);
			expect(r.reads).toBeLessThanOrEqual(25);
			const s = run(scan, plan(find, [{ args: [xs, 1998], reads: true }])).records['c0:0'] as {
				reads: number;
			};
			expect(s.reads).toBe(1000);
			expect(
				(
					run(scan, plan(find, [{ args: [xs, 1998], reads: false }])).records['c0:0'] as {
						reads: unknown;
					}
				).reads
			).toBeNull();
		});

		it('counts spread, slice and includes as reading every value', () => {
			for (const body of [
				'const c = [...xs]; return 1;',
				'xs.slice(); return 1;',
				'xs.includes(-1); return 1;',
				'xs.map((x) => x); return 1;'
			]) {
				const r = run(
					`function find(xs, t) { ${body} }`,
					plan(find, [{ args: [xs, 1], reads: true }])
				).records['c0:0'] as { reads: number };
				expect(r.reads, body).toBe(1000);
			}
		});

		it('does not count asking for the length', () => {
			const r = run(
				'function find(xs, t) { return xs.length; }',
				plan(find, [{ args: [xs, 1], reads: true }])
			).records['c0:0'] as { reads: number };
			expect(r.reads).toBe(0);
		});

		it('counts rows of a grid and the values inside them', () => {
			const grid = { name: 'g', params: [{ name: 'm', type: 'list[list[int]]' }], returns: 'int' };
			const r = run(
				'function g(m) { return m[1][1]; }',
				plan(grid, [
					{
						args: [
							[
								[1, 2],
								[3, 4]
							]
						],
						reads: true
					}
				])
			).records['c0:0'] as { out: number; reads: number };
			expect(r.out).toBe(4);
			expect(r.reads).toBe(2);
		});
	});

	describe('timing and skipping', () => {
		it('skips later performance calls once one was too slow, but still runs ordinary ones', () => {
			let t = 0;
			// Every call takes 5000 ms on this clock.
			const clock = () => (t += 2500);
			const p = plan(sum, [
				{ args: [1, 1], perf: true, limitMs: 100 },
				{ args: [2, 2], perf: true, limitMs: 100 },
				{ args: [3, 3], perf: false, limitMs: 100 }
			]);
			const { records } = run('function add(a, b) { return a + b; }', p, clock);
			expect(records['c0:0']).toMatchObject({ out: 2 });
			expect(records['c1:0']).toEqual({ skip: true });
			expect(records['c2:0']).toMatchObject({ out: 6 });
		});

		it('passes an unsupported call through without running it', () => {
			const { records } = run(
				'function add(a, b) { throw new Error("must not run"); }',
				plan(sum, [{ args: [1, 1], unsupported: 'too big' }])
			);
			expect(records['c0:0']).toEqual({ unsupported: 'too big' });
		});

		it('reports calls in plan order', () => {
			const keys: string[] = [];
			runJsCalls({
				source: 'function add(a, b) { return a + b; }',
				plan: plan(sum, [{ args: [1, 1] }, { args: [2, 2] }, { args: [3, 3] }]),
				now: () => 0,
				log: () => {},
				emit: (k) => keys.push(k)
			});
			expect(keys).toEqual(['c0:0', 'c1:0', 'c2:0']);
		});
	});

	it('answers a value JSON cannot hold with an error, not a crash', () => {
		const { records } = run(
			'function add(a, b) { return () => 1; }',
			plan(sum, [{ args: [1, 1] }])
		);
		expect(records['c0:0']).toHaveProperty('error');
	});
});
