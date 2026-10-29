import { parseType, type Shape } from '../ide-content/build-language-starters';
import type {
	WireInt,
	ExternalCall,
	ExternalFunction,
	ExternalPlan,
	ExternalRecord,
	WireList
} from './external-protocol';

// The text the typed languages (C++, Java, Go, Rust) use to receive their inputs and report their answers.
// Their drivers (external-driver.ts) have a small reader and writer for it, because none of them can be
// handed JSON in a line. Everything is whitespace separated tokens:
//
//   int, float          the number                      12   -3   0.5
//   bool                1 or 0                          1
//   str                 "s" then the text, with every byte except letters and digits as %XX     shello%20world   s
//   list of X           the count, then each X          3 5 6 7
//   ListNode            the values (as a list), then the position the tail loops back to (-1 for none),
//                       then the parameter number and position it joins (-1 -1 for none)
//   TreeNode            a list whose items are a number or "_" for a missing child (level order)
//
// Inputs: the call count, then one call per line: "<id> <perf 0|1> <limit in ms> <argument>...".
// Outputs: one line per call on the program's stdout, starting with a code word only this run knows so
// nothing the student prints can be taken for an answer:
//   "<code> <id> ok <ms> <answer>" | "<code> <id> err <message as str token>" | "<code> <id> skip"

export type TypedLanguage = 'cpp' | 'java' | 'go' | 'rust';

export const NULL_TOKEN = '_';

function encodeStr(value: string): string {
	let out = 's';
	for (const byte of new TextEncoder().encode(value)) {
		const c = String.fromCharCode(byte);
		out += /[A-Za-z0-9]/.test(c) ? c : '%' + byte.toString(16).toUpperCase().padStart(2, '0');
	}
	return out;
}

export function decodeStr(token: string): string {
	const bytes: number[] = [];
	const body = token.slice(1);
	for (let i = 0; i < body.length; i++) {
		if (body[i] === '%') {
			bytes.push(parseInt(body.slice(i + 1, i + 3), 16));
			i += 2;
		} else bytes.push(body.charCodeAt(i));
	}
	return new TextDecoder().decode(new Uint8Array(bytes));
}

function wireIntText(value: unknown): string {
	return typeof value === 'object' && value !== null && '$int' in value
		? String((value as { $int: string }).$int)
		: String(value);
}

function encodeValue(shape: Shape, value: unknown, tokens: string[]): void {
	if (shape.kind === 'scalar') {
		if (shape.scalar === 'str') tokens.push(encodeStr(String(value)));
		else if (shape.scalar === 'bool') tokens.push(value ? '1' : '0');
		else tokens.push(wireIntText(value));
		return;
	}
	if (shape.kind === 'list') {
		const items = value as unknown[];
		tokens.push(String(items.length));
		const inner: Shape =
			shape.depth > 1
				? { kind: 'list', depth: shape.depth - 1, scalar: shape.scalar }
				: { kind: 'scalar', scalar: shape.scalar };
		for (const item of items) encodeValue(inner, item, tokens);
		return;
	}
	if (shape.node === 'TreeNode') {
		const items = value as (WireInt | null)[];
		tokens.push(String(items.length));
		for (const item of items) tokens.push(item === null ? NULL_TOKEN : wireIntText(item));
	}
}

/** The one line of the input for a call. A list that joins another parameter's list names it by position. */
export function encodeCall(fn: ExternalFunction, call: ExternalCall, id: number): string {
	const tokens = [String(id), call.perf ? '1' : '0', String(Math.ceil(call.limitMs))];
	fn.params.forEach((param, i) => {
		const shape = parseType(param.type)!;
		const value = call.args[i];
		if (shape.kind === 'node' && shape.node === 'ListNode') {
			const list = value as WireList;
			// Pushed one by one: spreading a list of 100,000 values into push() overflows the call stack.
			tokens.push(String(list.values.length));
			for (const v of list.values) tokens.push(wireIntText(v));
			tokens.push(String(list.cycle));
			if (list.join) {
				tokens.push(String(fn.params.findIndex((p) => p.name === list.join!.param)));
				tokens.push(String(list.join.index));
			} else tokens.push('-1', '-1');
		} else encodeValue(shape, value, tokens);
	});
	return tokens.join(' ');
}

export function encodeCalls(fn: ExternalFunction, calls: ExternalCall[]): string {
	return [String(calls.length), ...calls.map((c, i) => encodeCall(fn, c, i))].join('\n') + '\n';
}

class Tokens {
	private i = 0;
	constructor(private readonly items: string[]) {}
	next(): string {
		if (this.i >= this.items.length) throw new Error('The answer ended early.');
		return this.items[this.i++];
	}
	get done() {
		return this.i >= this.items.length;
	}
}

function decodeValue(shape: Shape, t: Tokens): string {
	if (shape.kind === 'scalar') {
		const token = t.next();
		if (shape.scalar === 'str') return JSON.stringify(decodeStr(token));
		if (shape.scalar === 'bool') return token === '1' ? 'true' : 'false';
		if (shape.scalar === 'int') {
			// Kept as the digits the program wrote: a 64-bit answer does not fit a JavaScript number.
			if (!/^-?\d+$/.test(token)) throw new Error(`The answer ${token} is not a whole number.`);
			return token;
		}
		if (!Number.isFinite(Number(token))) throw new Error(`The answer ${token} is not a number.`);
		return String(Number(token));
	}
	if (shape.kind === 'list') {
		const count = Number(t.next());
		const inner: Shape =
			shape.depth > 1
				? { kind: 'list', depth: shape.depth - 1, scalar: shape.scalar }
				: { kind: 'scalar', scalar: shape.scalar };
		return '[' + Array.from({ length: count }, () => decodeValue(inner, t)).join(',') + ']';
	}
	const count = Number(t.next());
	return (
		'[' +
		Array.from({ length: count }, () => {
			const token = t.next();
			if (token === NULL_TOKEN) return 'null';
			if (!/^-?\d+$/.test(token)) throw new Error(`The answer ${token} is not a whole number.`);
			return token;
		}).join(',') +
		']'
	);
}

/** Reads one answer's tokens (after "ok <ms>") back into JSON text for the judge. */
export function decodeAnswer(fn: ExternalFunction, tokens: string[]): string {
	return decodeValue(parseType(fn.returns)!, new Tokens(tokens));
}

export interface ParsedLine {
	id: number;
	record: ExternalRecord;
}

/**
 * One line the program printed. Returns null for anything that is not an answer line of this run (the
 * student's own output), so it can be shown as output instead.
 */
export function parseResultLine(
	line: string,
	code: string,
	fn: ExternalFunction,
	calls: ExternalCall[]
): ParsedLine | null {
	if (!line.startsWith(code + ' ')) return null;
	const parts = line
		.slice(code.length + 1)
		.trim()
		.split(/\s+/);
	const id = Number(parts[0]);
	if (!Number.isInteger(id) || id < 0 || id >= calls.length) return null;
	const kind = parts[1];
	if (kind === 'skip') return { id, record: { skip: true } };
	if (kind === 'err') return { id, record: { error: decodeStr(parts[2] ?? 's') } };
	if (kind === 'ok') {
		try {
			const outJson = decodeAnswer(fn, parts.slice(3));
			// Reads cannot be counted outside JavaScript.
			return { id, record: { outJson, ms: Number(parts[2]), reads: null } };
		} catch (err) {
			return { id, record: { error: err instanceof Error ? err.message : String(err) } };
		}
	}
	return null;
}

// What each typed language can hold exactly inside a linked list or tree node: C++'s starter uses int.
const NODE_VALUE_LIMIT: Record<TypedLanguage, number> = {
	cpp: 2147483647,
	java: Number.MAX_SAFE_INTEGER,
	go: Number.MAX_SAFE_INTEGER,
	rust: Number.MAX_SAFE_INTEGER
};

/** Whether the typed starters have this question's function, and why not if they do not. */
export function unsupportedReason(fn: ExternalFunction): string | null {
	const shapes = [...fn.params.map((p) => p.type), fn.returns].map(parseType);
	if (shapes.some((s) => s === null)) {
		return 'this question has a type that only Python and JavaScript have so far, so it was not run in this language.';
	}
	return null;
}

/** Marks calls whose node values do not fit the language's node class as unsupported rather than wrong. */
export function markNodeLimits(plan: ExternalPlan, language: TypedLanguage): void {
	const limit = NODE_VALUE_LIMIT[language];
	const fn = plan.function;
	const tooBig = (v: WireInt) => typeof v !== 'number' || Math.abs(v) > limit;
	for (const call of plan.calls) {
		if (call.unsupported) continue;
		// Option<Box<ListNode>> is a chain with one owner per node: a list that loops or shares a tail cannot exist.
		if (
			language === 'rust' &&
			fn.params.some((p, i) => {
				const list = p.type === 'ListNode' ? (call.args[i] as WireList) : null;
				return list !== null && (list.cycle >= 0 || list.join !== null);
			})
		) {
			call.unsupported =
				'this test builds a list that loops back or shares nodes, which a Rust Option<Box<ListNode>> cannot be, so it was not run.';
			continue;
		}
		const big = fn.params.some((p, i) => {
			if (p.type === 'ListNode') return (call.args[i] as WireList).values.some(tooBig);
			if (p.type === 'TreeNode') {
				return (call.args[i] as (WireInt | null)[]).some((v) => v !== null && tooBig(v));
			}
			return false;
		});
		if (big) {
			call.unsupported =
				"a node value here is bigger than this language's node class can hold, so it was not run.";
		}
	}
}

/** What a student can act on, from how a WebAssembly program died. */
export function friendlyCrash(message: string): string {
	const text = message.trim();
	if (/call stack|stack overflow|StackOverflow/i.test(text)) {
		return 'Stack overflow: the program recursed too deeply. Look for recursion that never stops, or use a loop.';
	}
	if (/out of bounds|index out of range|IndexOutOfBounds|ArrayIndexOutOfBounds/i.test(text)) {
		return `The program read or wrote outside an array, vector or string.\n${text}`;
	}
	if (/out of memory|alloc|OutOfMemory|memory/i.test(text) && !/panicked/.test(text)) {
		return 'The program ran out of memory. Look for a much larger array than you need.';
	}
	if (/^(RuntimeError: )?unreachable/i.test(text) || text === '') {
		return 'The program crashed (an abort, a failed assert, or an invalid operation).';
	}
	return text;
}
