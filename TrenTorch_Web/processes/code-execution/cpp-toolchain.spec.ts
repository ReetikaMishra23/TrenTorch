// Runs the real clang and wasm-ld from platform/static/cpp-runtime, so these tests are slower than most
// (the compiler is 44 MB of WebAssembly) but are the only thing that proves the C++ runtime works.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { CppToolchain } from './cpp-toolchain';
import bitsStdcpp from './cpp-bits-stdcpp.h?raw';
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

describe('CppToolchain', () => {
	it('compiles and runs a program', async () => {
		const result = await toolchain.run(
			'#include <iostream>\nint main() { std::cout << "hello" << std::endl; }'
		);
		expect(result.error).toBeNull();
		expect(result.output).toBe('hello\n');
	}, 60_000);

	it('supports the C++ that DSA solutions use', async () => {
		const result = await toolchain.run(`#include <bits/stdc++.h>
using namespace std;
struct TreeNode {
    int val; TreeNode* left; TreeNode* right;
    TreeNode(int x = 0, TreeNode* l = nullptr, TreeNode* r = nullptr) : val(x), left(l), right(r) {}
};
int depth(TreeNode* r) { return r ? 1 + max(depth(r->left), depth(r->right)) : 0; }
void bump(int& x) { x++; }
template <class T> T twice(T v) { return v + v; }
int main() {
    vector<pair<int, int>> v{{3, 1}, {1, 2}, {2, 0}};
    sort(v.begin(), v.end(), [](auto& a, auto& b) { return a.first < b.first; });
    function<long long(int)> fib = [&](int n) -> long long { return n < 2 ? n : fib(n - 1) + fib(n - 2); };
    map<string, int> m; m["a"]++;
    unordered_map<int, int> um; um[3] = 4;
    set<int> s{3, 1, 2};
    priority_queue<int, vector<int>, greater<int>> pq; pq.push(5); pq.push(2);
    deque<int> d{1, 2}; d.push_front(0);
    auto [x, y] = make_pair(1, 2);
    int a = 1; bump(a);
    TreeNode* t = new TreeNode(1, new TreeNode(2));
    mt19937 g(1); optional<int> o = 3;
    cout << v[0].first << " " << fib(15) << " " << m["a"] << um[3] << *s.begin() << pq.top() << d.front()
         << " " << x + y << " " << a << " " << depth(t) << " " << twice(21) << " " << __gcd(12, 18)
         << " " << *o << " " << (g() > 0) << endl;
}`);
		expect(result.error).toBeNull();
		expect(result.output).toBe('1 610 14120 3 2 2 42 6 3 1\n');
	}, 60_000);

	it('reports a compile error with its line number', async () => {
		const result = await toolchain.run('int main() {\n    int x = "oops";\n}\n');
		expect(result.output).toBe('');
		expect(result.error).toContain('main.cpp:2:');
		expect(result.error).toContain('error');
	}, 60_000);

	it('reports a program that exits with an error', async () => {
		const result = await toolchain.run(
			'#include <vector>\n#include <iostream>\nint main() { std::vector<int> v(2); std::cout << "before" << std::endl; return v.at(5); }'
		);
		expect(result.output).toBe('before\n');
		expect(result.error).toBeTruthy();
	}, 60_000);

	it('reports a program that returns a non-zero code', async () => {
		const result = await toolchain.run('int main() { return 3; }');
		expect(result.error).toBe('Program exited with code 3');
	}, 60_000);

	it('compiles the starter the generator writes, for several signatures', async () => {
		const signatures = [
			{
				name: 'count_pairs',
				params: [{ name: 'n', type: 'int' }],
				returns: 'int',
				example: { n: 4 }
			},
			{
				name: 'two_sum',
				params: [
					{ name: 'nums', type: 'list[int]' },
					{ name: 'target', type: 'int' }
				],
				returns: 'list[int]',
				example: { nums: [2, 7, 11], target: 9 }
			},
			{
				name: 'transpose',
				params: [{ name: 'grid', type: 'list[list[int]]' }],
				returns: 'list[list[int]]',
				example: {
					grid: [
						[1, 2],
						[3, 4]
					]
				}
			},
			{
				name: 'is_anagram',
				params: [
					{ name: 'a', type: 'str' },
					{ name: 'b', type: 'str' }
				],
				returns: 'bool',
				example: { a: 'ab', b: 'ba' }
			},
			{
				name: 'average',
				params: [{ name: 'xs', type: 'list[float]' }],
				returns: 'float',
				example: { xs: [1.5, 2] }
			},
			{
				name: 'trim_bst',
				params: [
					{ name: 'root', type: 'TreeNode' },
					{ name: 'low', type: 'int' }
				],
				returns: 'TreeNode'
			},
			{ name: 'reverse_list', params: [{ name: 'head', type: 'ListNode' }], returns: 'ListNode' },
			{ name: 'mod', params: [{ name: 'new', type: 'int' }], returns: 'int', example: { new: 1 } }
		];
		for (const signature of signatures) {
			const { cpp } = buildLanguageStarters(signature);
			const result = await toolchain.run(cpp);
			expect(result.error, `${signature.name}:\n${cpp}`).toBeNull();
		}
	}, 120_000);

	it('runs two programs in a row without them seeing each other', async () => {
		const first = await toolchain.run('#include <iostream>\nint main() { std::cout << 1; }');
		const second = await toolchain.run('#include <iostream>\nint main() { std::cout << 2; }');
		expect(first.output).toBe('1');
		expect(second.output).toBe('2');
	}, 60_000);
});
