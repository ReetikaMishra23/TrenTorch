import { describe, it, expect } from 'vitest';
import {
	decodeStr,
	encodeCall,
	encodeCalls,
	friendlyCrash,
	markNodeLimits,
	parseResultLine,
	unsupportedReason
} from './external-codec';
import type { ExternalCall, ExternalFunction, ExternalPlan } from './external-protocol';

const fn = (params: [string, string][], returns: string): ExternalFunction => ({
	name: 'f',
	params: params.map(([name, type]) => ({ name, type })),
	returns
});
const call = (args: unknown[], extra: Partial<ExternalCall> = {}): ExternalCall => ({
	key: 'k',
	case: 'c',
	index: 0,
	args,
	limitMs: 1500.4,
	perf: false,
	reads: false,
	batch: false,
	...extra
});

describe('encodeCall', () => {
	it('writes id, perf flag, whole-millisecond limit, then every argument as tokens', () => {
		const f = fn(
			[
				['xs', 'list[int]'],
				['t', 'int'],
				['s', 'str']
			],
			'int'
		);
		expect(encodeCall(f, call([[3, -1], 9, 'a b'], { perf: true }), 4)).toBe(
			'4 1 1501 2 3 -1 9 sa%20b'
		);
	});

	it('writes strings as bytes so any text survives, and empty text as a bare s', () => {
		const f = fn([['s', 'str']], 'int');
		expect(encodeCall(f, call(['é%\n']), 0)).toBe('0 0 1501 s%C3%A9%25%0A');
		expect(encodeCall(f, call(['']), 0)).toBe('0 0 1501 s');
		for (const text of ['', 'abc', 'a b%é\n\t😀', '%41']) {
			expect(decodeStr(encodeCall(f, call([text]), 0).split(' ')[3])).toBe(text);
		}
	});

	it('writes nested lists, trees with holes, and big integers exactly', () => {
		const f = fn(
			[
				['g', 'list[list[int]]'],
				['t', 'TreeNode'],
				['n', 'int']
			],
			'int'
		);
		expect(
			encodeCall(f, call([[[1, 2], []], [1, null, 2], { $int: '9223372036854775807' }]), 0)
		).toBe('0 0 1501 2 2 1 2 0 3 1 _ 2 9223372036854775807');
	});

	it('writes a linked list with its cycle and the parameter it joins by position', () => {
		const f = fn(
			[
				['a', 'ListNode'],
				['b', 'ListNode']
			],
			'int'
		);
		const joined = { values: [9], cycle: -1, join: { param: 'a', index: 1 } };
		expect(encodeCall(f, call([{ values: [1, 2], cycle: 1, join: null }, joined]), 0)).toBe(
			'0 0 1501 2 1 2 1 -1 -1 1 9 -1 0 1'
		);
	});

	it('handles lists and trees of hundreds of thousands of values', () => {
		const n = 400_000;
		const values = Array.from({ length: n }, (_, i) => i);
		const f = fn(
			[
				['h', 'ListNode'],
				['xs', 'list[int]'],
				['t', 'TreeNode']
			],
			'int'
		);
		const line = encodeCall(
			f,
			call([{ values, cycle: -1, join: null }, values, values.map((v) => (v % 2 ? null : v))]),
			0
		);
		expect(line.split(' ')).toHaveLength(3 + 1 + n + 3 + 1 + n + 1 + n);
	});

	it('starts the input with the call count', () => {
		const f = fn([['n', 'int']], 'int');
		expect(encodeCalls(f, [call([1]), call([2])]).split('\n')).toEqual([
			'2',
			'0 0 1501 1',
			'1 0 1501 2',
			''
		]);
	});
});

describe('parseResultLine', () => {
	const calls = [call([]), call([])];
	const f = (returns: string) => fn([], returns);

	it('reads an answer back as JSON text, keeping long integers whole', () => {
		expect(
			parseResultLine('TTx 1 ok 0.250 3 9223372036854775807 -2 0', 'TTx', f('list[int]'), calls)
		).toEqual({
			id: 1,
			record: { outJson: '[9223372036854775807,-2,0]', ms: 0.25, reads: null }
		});
	});

	it('reads strings, bools, floats, nested lists and trees', () => {
		const one = (returns: string, tokens: string) =>
			(
				parseResultLine(`TTx 0 ok 1 ${tokens}`, 'TTx', f(returns), calls)!.record as {
					outJson: string;
				}
			).outJson;
		expect(one('str', 's%C3%A9a')).toBe('"éa"');
		expect(one('bool', '1')).toBe('true');
		expect(one('float', '0.5')).toBe('0.5');
		expect(one('list[list[str]]', '2 2 sa sb 0')).toBe('[["a","b"],[]]');
		expect(one('list[bool]', '2 1 0')).toBe('[true,false]');
		expect(one('TreeNode', '3 1 _ 2')).toBe('[1,null,2]');
	});

	it('reports a skip, an error and a malformed answer', () => {
		expect(parseResultLine('TTx 0 skip', 'TTx', f('int'), calls)!.record).toEqual({ skip: true });
		expect(parseResultLine('TTx 0 err s%42oom', 'TTx', f('int'), calls)!.record).toEqual({
			error: 'Boom'
		});
		expect(
			(parseResultLine('TTx 0 ok 1 abc', 'TTx', f('int'), calls)!.record as { error: string }).error
		).toMatch(/not a whole number/);
		expect(
			(parseResultLine('TTx 0 ok 1 NaN', 'TTx', f('float'), calls)!.record as { error: string })
				.error
		).toMatch(/not a number/);
		expect(
			(parseResultLine('TTx 0 ok 1 3 1', 'TTx', f('list[int]'), calls)!.record as { error: string })
				.error
		).toMatch(/ended early/);
	});

	it("leaves everything that is not this run's answer alone", () => {
		for (const line of [
			'hello',
			'TTy 0 ok 1 3',
			'TTx 7 ok 1 3',
			'TTx x ok 1 3',
			'TTx 0 what',
			''
		]) {
			expect(parseResultLine(line, 'TTx', f('int'), calls), line).toBeNull();
		}
	});
});

describe('unsupported questions', () => {
	it('reports a type the typed languages have no starter for', () => {
		expect(unsupportedReason(fn([['x', 'list']], 'int'))).toMatch(/only Python and JavaScript/);
		expect(unsupportedReason(fn([['x', 'int']], 'ListNodeRef'))).toMatch(
			/only Python and JavaScript/
		);
		expect(unsupportedReason(fn([['x', 'list[int]']], 'TreeNode'))).toBeNull();
	});

	it('marks calls whose node values do not fit', () => {
		const plan = (args: unknown[]): ExternalPlan => ({
			function: fn([['t', 'TreeNode']], 'int'),
			compare: 'exact',
			calls: [call(args)]
		});
		const small = plan([[1, 2]]);
		markNodeLimits(small, 'cpp');
		expect(small.calls[0].unsupported).toBeUndefined();
		const big = plan([[1, 3000000000]]);
		markNodeLimits(big, 'cpp');
		expect(big.calls[0].unsupported).toMatch(/node value/);
		const huge = plan([[{ $int: '99999999999999999999' }]]);
		markNodeLimits(huge, 'java');
		expect(huge.calls[0].unsupported).toMatch(/node value/);
	});

	it('marks a list that loops or joins as not representable in Rust only', () => {
		const make = (): ExternalPlan => ({
			function: fn([['h', 'ListNode']], 'bool'),
			compare: 'exact',
			calls: [
				call([{ values: [1, 2], cycle: 0, join: null }]),
				call([{ values: [1, 2], cycle: -1, join: null }])
			]
		});
		const rust = make();
		markNodeLimits(rust, 'rust');
		expect(rust.calls[0].unsupported).toMatch(/loops back or shares/);
		expect(rust.calls[1].unsupported).toBeUndefined();
		const go = make();
		markNodeLimits(go, 'go');
		expect(go.calls[0].unsupported).toBeUndefined();
	});
});

describe('friendlyCrash', () => {
	it('explains how a WebAssembly program dies', () => {
		expect(friendlyCrash('RuntimeError: unreachable')).toMatch(/crashed/);
		expect(friendlyCrash('')).toMatch(/crashed/);
		expect(friendlyCrash('RangeError: Maximum call stack size exceeded')).toMatch(/Stack overflow/);
		expect(friendlyCrash('RuntimeError: memory access out of bounds')).toMatch(/outside an array/);
		expect(friendlyCrash("thread 'main' panicked at program:1:3:\nboom")).toMatch(/panicked/);
	});
});
