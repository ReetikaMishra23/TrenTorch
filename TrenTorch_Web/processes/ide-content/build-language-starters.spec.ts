import { describe, expect, it } from 'vitest';
import { buildLanguageStarters } from './build-language-starters';

const countPairs = {
	name: 'count_pairs',
	params: [{ name: 'n', type: 'int' }],
	returns: 'int',
	example: { n: 4 }
};

describe('buildLanguageStarters', () => {
	it('writes the function in each language with a main that calls the example', () => {
		const s = buildLanguageStarters(countPairs);
		expect(s.javascript).toContain('function countPairs(n) {');
		expect(s.javascript).toContain('console.log(countPairs(4));');
		expect(s.cpp).toContain('int countPairs(int n) {');
		expect(s.cpp).toContain('cout << countPairs(4) << endl;');
		expect(s.java).toContain('static long countPairs(long n) {');
		expect(s.java).toContain('System.out.println(countPairs(4L));');
		expect(s.go).toContain('func countPairs(n int) int {');
		expect(s.go).toContain('fmt.Println(countPairs(4))');
		expect(s.rust).toContain('fn count_pairs(n: i64) -> i64 {');
		expect(s.rust).toContain('println!("{:?}", count_pairs(4));');
		// A panicking stub would show up as "unreachable" the moment the student presses Run.
		expect(s.rust).not.toContain('todo!');
	});

	it("uses each language's list, string and bool types", () => {
		const s = buildLanguageStarters({
			name: 'has_dup',
			params: [
				{ name: 'nums', type: 'list[int]' },
				{ name: 'label', type: 'str' }
			],
			returns: 'bool',
			example: { nums: [1, 2, 2], label: 'a' }
		});
		expect(s.cpp).toContain('bool hasDup(vector<int> nums, string label)');
		expect(s.cpp).toContain('hasDup(vector<int>{1, 2, 2}, "a")');
		expect(s.java).toContain('static boolean hasDup(long[] nums, String label)');
		expect(s.java).toContain('new long[]{1L, 2L, 2L}');
		expect(s.go).toContain('func hasDup(nums []int, label string) bool');
		expect(s.go).toContain('[]int{1, 2, 2}');
		expect(s.rust).toContain('fn has_dup(nums: Vec<i64>, label: String) -> bool');
		expect(s.rust).toContain('vec![1, 2, 2]');
		expect(s.rust).toContain('String::from("a")');
	});

	it('handles nested lists and list returns', () => {
		const s = buildLanguageStarters({
			name: 'transpose',
			params: [{ name: 'grid', type: 'list[list[int]]' }],
			returns: 'list[list[int]]',
			example: {
				grid: [
					[1, 2],
					[3, 4]
				]
			}
		});
		expect(s.cpp).toContain('vector<vector<int>> transpose(vector<vector<int>> grid)');
		expect(s.java).toContain('long[][] transpose(long[][] grid)');
		expect(s.java).toContain('Arrays.deepToString(transpose(');
		expect(s.java).toContain('return new long[0][];');
		expect(s.go).toContain('[][]int{[]int{1, 2}, []int{3, 4}}');
		expect(s.rust).toContain('vec![vec![1, 2], vec![3, 4]]');
	});

	it('declares tree and list nodes and skips the example call', () => {
		const s = buildLanguageStarters({
			name: 'trim_bst',
			params: [
				{ name: 'root', type: 'TreeNode' },
				{ name: 'low', type: 'int' }
			],
			returns: 'TreeNode',
			example: { root: [3, 0, 4], low: 1 }
		});
		expect(s.javascript).toContain('class TreeNode');
		expect(s.javascript).not.toContain('console.log(trimBst');
		expect(s.cpp).toContain('struct TreeNode');
		expect(s.java).toContain('class TreeNode');
		expect(s.go).toContain('type TreeNode struct');
		expect(s.go).not.toContain('import "fmt"');
		expect(s.rust).toContain('struct TreeNode');
	});

	it('still returns a starter for a type it cannot express', () => {
		const s = buildLanguageStarters({
			name: 'odd',
			params: [{ name: 'x', type: 'ListNodeRef' }],
			returns: 'int'
		});
		for (const code of Object.values(s)) expect(code).toContain('problem statement');
	});

	it('formats whole-number floats and reads strings safely', () => {
		const s = buildLanguageStarters({
			name: 'scale',
			params: [
				{ name: 'x', type: 'float' },
				{ name: 's', type: 'str' }
			],
			returns: 'float',
			example: { x: 2, s: 'say "hi"' }
		});
		expect(s.go).toContain('scale(2.0, "say \\"hi\\"")');
	});
});
