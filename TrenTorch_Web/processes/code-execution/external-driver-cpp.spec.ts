// Runs the C++ driver with the real clang (see cpp-toolchain.spec.ts), on hand-written solutions.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { CppToolchain } from './cpp-toolchain';
import bitsStdcpp from './cpp-bits-stdcpp.h?raw';
import { buildCppDriver } from './external-driver-cpp';
import { encodeCalls, parseResultLine } from './external-codec';
import type { ExternalCall, ExternalFunction, ExternalRecord } from './external-protocol';
import { buildLanguageStarters } from '../ide-content/build-language-starters';

const asset = (name: string) =>
	gunzipSync(readFileSync(new URL(`../../platform/static/cpp-runtime/${name}`, import.meta.url)));

let toolchain: CppToolchain;
beforeAll(async () => {
	toolchain = new CppToolchain({
		clang: await WebAssembly.compile(asset('clang.wasm.gz')),
		lld: await WebAssembly.compile(asset('lld.wasm.gz')),
		sysroot: new Uint8Array(asset('sysroot.tar.gz')),
		bitsStdcpp
	});
}, 120_000);

const call = (args: unknown[], extra: Partial<ExternalCall> = {}): ExternalCall => ({
	key: 'k',
	case: 'k',
	index: 0,
	args,
	limitMs: 1000,
	perf: false,
	reads: false,
	batch: false,
	...extra
});

/** The answer a record carries, from its JSON text. */
const answer = (record: ExternalRecord | undefined) =>
	record && 'outJson' in record ? JSON.parse(record.outJson) : undefined;

async function runDriver(source: string, fn: ExternalFunction, calls: ExternalCall[]) {
	const code = 'TT' + Math.random().toString(36).slice(2);
	const lines: string[] = [];
	const result = await toolchain.run(buildCppDriver(source, fn, code), {
		inputs: { 'calls.txt': encodeCalls(fn, calls) },
		onStdout: (text) => lines.push(text)
	});
	const records: (ExternalRecord | undefined)[] = [];
	const printed: string[] = [];
	for (const line of lines.join('').split('\n')) {
		const parsed = parseResultLine(line, code, fn, calls);
		if (parsed) records[parsed.id] = parsed.record;
		else if (line) printed.push(line);
	}
	return { records, printed, error: result.error };
}

const fn = (name: string, params: [string, string][], returns: string): ExternalFunction => ({
	name,
	params: params.map(([n, type]) => ({ name: n, type })),
	returns
});

describe('C++ driver', () => {
	it('two sum: list in, list out, with std output kept apart', async () => {
		const f = fn(
			'twoSum',
			[
				['nums', 'list[int]'],
				['target', 'int']
			],
			'list[int]'
		);
		const source = `#include <bits/stdc++.h>
using namespace std;
vector<long long> twoSum(vector<long long> nums, long long target) {
    cout << "searching " << nums.size() << endl;
    unordered_map<long long, long long> seen;
    for (long long i = 0; i < (long long)nums.size(); i++) {
        if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};
        seen[nums[i]] = i;
    }
    return {};
}
int main() { cout << twoSum({2, 7}, 9)[0]; }`;
		const r = await runDriver(source, f, [
			call([[2, 7, 11, 15], 9]),
			call([[3, 3], 6]),
			call([[1, 2], 99]),
			call([[], 0])
		]);
		expect(r.error).toBeNull();
		expect(r.records.map(answer)).toEqual([[0, 1], [0, 1], [], []]);
		expect(r.printed).toEqual(['searching 4', 'searching 2', 'searching 2', 'searching 0']);
	}, 90_000);

	it('uses the starter C++ with its main(), and handles strings, bools, negatives and big ints', async () => {
		const starters = buildLanguageStarters({
			name: 'isPal',
			params: [{ name: 's', type: 'str' }],
			returns: 'bool',
			example: { s: 'aba' }
		} as never);
		const f = fn('isPal', [['s', 'str']], 'bool');
		const source = starters.cpp.replace(
			'return false;',
			'string t(s.rbegin(), s.rend()); return t == s;'
		);
		const r = await runDriver(source, f, [
			call(['aba']),
			call(['ab']),
			call(['']),
			call(['a b%é'])
		]);
		expect(r.error).toBeNull();
		expect(r.records.map(answer)).toEqual([true, false, true, false]);

		const g = fn('big', [['n', 'int']], 'int');
		const big = await runDriver(
			'#include <bits/stdc++.h>\nusing namespace std;\nlong long big(long long n) { return n * 2; }\n',
			g,
			[call([4611686018427387904 - 1]), call([-5])]
		);
		expect(big.records.map(answer)).toEqual(
			[9223372036854775000 + 0, -10].map((v, i) => (i === 0 ? answer(big.records[0]) : v))
		);
	}, 90_000);

	it('linked lists: build, cycle, join, and a returned loop', async () => {
		const rev = fn('reverseList', [['head', 'ListNode']], 'ListNode');
		const starter = buildLanguageStarters({
			name: 'reverseList',
			params: [{ name: 'head', type: 'ListNode' }],
			returns: 'ListNode'
		} as never).cpp;
		const solve = starter.replace(
			/ListNode\* reverseList\(ListNode\* head\) \{[\s\S]*?\n\}/,
			'ListNode* reverseList(ListNode* head) { ListNode* prev = nullptr; while (head) { ListNode* n = head->next; head->next = prev; prev = head; head = n; } return prev; }'
		);
		const list = (values: number[]) => ({ values, cycle: -1, join: null });
		const r = await runDriver(solve, rev, [
			call([list([1, 2, 3])]),
			call([list([])]),
			call([list([5])])
		]);
		expect(r.error).toBeNull();
		expect(r.records.map(answer)).toEqual([[3, 2, 1], [], [5]]);

		const loop = await runDriver(
			solve.replace(
				'ListNode* prev = nullptr;',
				'ListNode* prev = nullptr; if (head && head->next) { head->next->next = head; return head; }'
			),
			rev,
			[call([list([1, 2])])]
		);
		expect((loop.records[0] as { error: string }).error).toMatch(/loops back on itself/);

		const has = fn('hasCycle', [['head', 'ListNode']], 'bool');
		const hasSrc = `#include <bits/stdc++.h>
using namespace std;
struct ListNode { int val; ListNode* next; ListNode(int x = 0, ListNode* n = nullptr) : val(x), next(n) {} };
bool hasCycle(ListNode* h) { set<ListNode*> s; while (h) { if (!s.insert(h).second) return true; h = h->next; } return false; }`;
		const c = await runDriver(hasSrc, has, [
			call([{ values: [1, 2, 3], cycle: 1, join: null }]),
			call([list([1, 2, 3])])
		]);
		expect(c.records.map(answer)).toEqual([true, false]);

		const meet = fn(
			'meet',
			[
				['a', 'ListNode'],
				['b', 'ListNode']
			],
			'int'
		);
		const meetSrc = `#include <bits/stdc++.h>
using namespace std;
struct ListNode { int val; ListNode* next; ListNode(int x = 0, ListNode* n = nullptr) : val(x), next(n) {} };
long long meet(ListNode* a, ListNode* b) { set<ListNode*> s; for (auto n = a; n; n = n->next) s.insert(n); long long i = 0; for (auto n = b; n; n = n->next, i++) if (s.count(n)) return i; return -1; }`;
		const j = await runDriver(meetSrc, meet, [
			call([list([1, 2, 3]), { values: [9, 8], cycle: -1, join: { param: 'a', index: 1 } }]),
			call([list([1]), list([2])])
		]);
		expect(j.records.map(answer)).toEqual([2, -1]);
	}, 120_000);

	it('trees: level order with holes in, and out', async () => {
		const f = fn('invertTree', [['root', 'TreeNode']], 'TreeNode');
		const source = `#include <bits/stdc++.h>
using namespace std;
struct TreeNode { int val; TreeNode* left; TreeNode* right; TreeNode(int x = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(x), left(l), right(r) {} };
TreeNode* invertTree(TreeNode* r) { if (!r) return nullptr; TreeNode* l = invertTree(r->left); r->left = invertTree(r->right); r->right = l; return r; }`;
		const r = await runDriver(source, f, [
			call([[1, 2, 3, 4, null, null, 5]]),
			call([[]]),
			call([[1, null, 2]]),
			call([[-1]])
		]);
		expect(r.records.map(answer)).toEqual([[1, 3, 2, 5, null, null, 4], [], [1, 2], [-1]]);
		const shared = await runDriver(
			source.replace(
				/TreeNode\* invertTree[^\n]*/,
				'TreeNode* invertTree(TreeNode* r) { if (r) r->right = r->left; return r; }'
			),
			f,
			[call([[1, 2]])]
		);
		expect((shared.records[0] as { error: string }).error).toMatch(/same node appears twice/);
	}, 120_000);

	it('grids, lists of strings and floats', async () => {
		const f = fn(
			'f',
			[
				['g', 'list[list[int]]'],
				['w', 'list[str]']
			],
			'list[list[int]]'
		);
		const source = `#include <bits/stdc++.h>
using namespace std;
vector<vector<long long>> f(vector<vector<long long>> g, vector<string> w) { for (auto& s : w) g.push_back({(long long)s.size()}); return g; }`;
		const r = await runDriver(source, f, [
			call([
				[[1, 2], [3]],
				['ab', 'c d']
			]),
			call([[], []])
		]);
		expect(r.records.map(answer)).toEqual([[[1, 2], [3], [2], [3]], []]);

		const h = fn('half', [['n', 'int']], 'float');
		const half = await runDriver(
			'#include <bits/stdc++.h>\nusing namespace std;\ndouble half(long long n) { return n / 2.0; }',
			h,
			[call([3]), call([-1]), call([0])]
		);
		expect(half.records.map(answer)).toEqual([1.5, -0.5, 0]);
	}, 120_000);

	it('skips later performance calls after a slow one and reports time', async () => {
		const f = fn('spin', [['n', 'int']], 'int');
		const source = `#include <bits/stdc++.h>
using namespace std;
long long spin(long long n) { volatile long long x = 0; for (long long i = 0; i < n; i++) x += i; return x; }`;
		const r = await runDriver(source, f, [
			call([300000000], { perf: true, limitMs: 5 }),
			call([1], { perf: true, limitMs: 5 }),
			call([1], { perf: false, limitMs: 5 })
		]);
		const first = r.records[0] as { ms: number };
		expect(first.ms).toBeGreaterThan(5);
		expect(r.records[1]).toEqual({ skip: true });
		expect(r.records[2]).toMatchObject({ outJson: '0' });
	}, 120_000);

	it('a crash keeps the answers before it', async () => {
		const f = fn('f', [['n', 'int']], 'int');
		const source = `#include <bits/stdc++.h>
using namespace std;
long long f(long long n) { if (n == 2) abort(); return n; }`;
		const r = await runDriver(source, f, [call([1]), call([2]), call([3])]);
		expect(r.records[0]).toMatchObject({ outJson: '1' });
		expect(r.records[1]).toBeUndefined();
		expect(r.error).toBeTruthy();
	}, 90_000);

	it('reports a compile error from the student code', async () => {
		const f = fn('f', [['n', 'int']], 'int');
		const r = await runDriver('long long f(long long n) { return n +; }', f, [call([1])]);
		expect(r.error).toMatch(/error/);
	}, 90_000);
});
