import { compileStudentCode } from './student-function';
import { ident } from '../ide-content/build-language-starters';
import type { ExternalCall, ExternalPlan, ExternalRecord } from './external-protocol';

// Runs the student's JavaScript function on every call of an ExternalPlan (see external-protocol.ts) and
// reports one record per call as it finishes, so a program that gets stuck still leaves the earlier answers.
// Pure: the worker passes in how to print and how to read the clock, and tests use it directly.

interface ListNodeLike {
	val: number;
	next: ListNodeLike | null;
}
interface TreeNodeLike {
	val: number;
	left: TreeNodeLike | null;
	right: TreeNodeLike | null;
}

// The classes the starter code defines. A student who deletes them still gets these.
const NODE_CLASSES = `
class ListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } }
class TreeNode { constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; } }
`;

type WireList = { values: number[]; cycle: number; join: { param: string; index: number } | null };

/** The linked lists of one call, so a returned node can be named by its position in the first list. */
interface Built {
	nodes: Map<string, ListNodeLike[]>;
}

function buildList(make: (v: number) => ListNodeLike, spec: WireList, built: Built, param: string) {
	const nodes: ListNodeLike[] = spec.values.map(make);
	nodes.forEach((n, i) => (n.next = nodes[i + 1] ?? null));
	if (spec.join) {
		// The tail joins another parameter's list at `index`, so both lists end in the same nodes.
		const other = built.nodes.get(spec.join.param);
		const target = other?.[spec.join.index];
		if (nodes.length && target) nodes[nodes.length - 1].next = target;
	}
	if (spec.cycle >= 0 && nodes.length) nodes[nodes.length - 1].next = nodes[spec.cycle];
	built.nodes.set(param, nodes);
	return nodes[0] ?? null;
}

function buildTree(
	make: (v: number) => TreeNodeLike,
	items: (number | null)[]
): TreeNodeLike | null {
	if (!items.length || items[0] === null) return null;
	const root = make(items[0] as number);
	const queue = [root];
	let i = 1;
	for (const node of queue) {
		if (i < items.length && items[i] !== null) {
			node.left = make(items[i] as number);
			queue.push(node.left);
		}
		i++;
		if (i < items.length && items[i] !== null) {
			node.right = make(items[i] as number);
			queue.push(node.right);
		}
		i++;
	}
	return root;
}

function listValues(head: ListNodeLike | null): number[] {
	const values: number[] = [];
	const seen = new Set<ListNodeLike>();
	while (head) {
		if (seen.has(head)) {
			throw new Error(
				'Your answer is a list that loops back on itself. Check the last next pointer.'
			);
		}
		seen.add(head);
		values.push(head.val);
		head = head.next;
	}
	return values;
}

function treeList(root: TreeNodeLike | null): (number | null)[] {
	const out: (number | null)[] = [];
	const queue: (TreeNodeLike | null)[] = [root];
	const seen = new Set<TreeNodeLike>();
	for (const node of queue) {
		if (!node) {
			out.push(null);
			continue;
		}
		if (seen.has(node)) {
			throw new Error('Your answer is not a tree: the same node appears twice.');
		}
		seen.add(node);
		out.push(node.val);
		queue.push(node.left ?? null, node.right ?? null);
	}
	while (out.length && out[out.length - 1] === null) out.pop();
	return out;
}

/** Counts every value the code reads out of a list, the way cases-runtime.py does for Python. */
function counted<T>(value: T, reads: { count: number }): T {
	if (!Array.isArray(value)) return value;
	const rows = value.map((row) => counted(row, reads));
	return new Proxy(rows, {
		get(target, key, receiver) {
			if (typeof key === 'string' && /^\d+$/.test(key)) reads.count++;
			return Reflect.get(target, key, receiver);
		}
	}) as T;
}

/** Evaluates the student's source once and returns their function and node classes (theirs, when they define them). */
function loadProgram(source: string, name: string, log: (...args: unknown[]) => void) {
	const quiet = { log, error: log, warn: log, info: log };
	// The student's code runs in an inner function so it can declare its own ListNode and TreeNode (the starter
	// does) without clashing with the ones above, which it falls back to when it does not.
	const factory = compileStudentCode(
		['console'],
		`"use strict";\n${NODE_CLASSES}\nreturn (function () {\n${source}\n;return { fn: typeof ${name} === 'function' ? ${name} : undefined, ListNode, TreeNode };\n})();`
	);
	const program = factory(quiet) as {
		fn: ((...args: unknown[]) => unknown) | undefined;
		ListNode: new (v: number) => ListNodeLike;
		TreeNode: new (v: number) => TreeNodeLike;
	};
	if (typeof program.fn !== 'function') {
		throw new Error(`Your code does not define a function named ${name}.`);
	}
	return program as typeof program & { fn: (...args: unknown[]) => unknown };
}

function makeNode<T>(Node: new (v: number) => T) {
	return (v: number) => new Node(v);
}

export interface RunOptions {
	source: string;
	plan: ExternalPlan;
	now: () => number;
	/** The student's console.log calls. */
	log: (...args: unknown[]) => void;
	/** Called after every call with its record, in plan order. */
	emit: (key: string, record: ExternalRecord) => void;
}

/** One call, start to finish. Exported so tests can drive a single call. */
export function runOneCall(
	fn: (...args: unknown[]) => unknown,
	plan: ExternalPlan,
	call: ExternalCall,
	now: () => number,
	classes: { ListNode: new (v: number) => ListNodeLike; TreeNode: new (v: number) => TreeNodeLike }
): ExternalRecord {
	const params = plan.function.params;
	const built: Built = { nodes: new Map() };
	const reads = { count: 0 };
	let args: unknown[];
	try {
		args = params.map((p, i) => {
			const wire = call.args[i];
			if (p.type === 'ListNode') {
				return buildList(makeNode(classes.ListNode), wire as WireList, built, p.name);
			}
			if (p.type === 'list[ListNode]') {
				return (wire as WireList[]).map((spec, j) =>
					buildList(makeNode(classes.ListNode), spec, built, `${p.name}#${j}`)
				);
			}
			if (p.type === 'TreeNode') {
				return buildTree(makeNode(classes.TreeNode), wire as (number | null)[]);
			}
			return call.reads ? counted(structuredClone(wire), reads) : structuredClone(wire);
		});
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
	let answer: unknown;
	const started = now();
	try {
		answer = fn(...args);
		if (answer instanceof Promise) {
			return { error: 'Your function returned a Promise. Return the answer directly.' };
		}
	} catch (err) {
		const e = err as Error;
		return { error: e?.message ? `${e.name || 'Error'}: ${e.message}` : String(err) };
	}
	const ms = now() - started;
	try {
		const returns = plan.function.returns;
		let out: unknown = answer;
		if (returns === 'ListNode') out = listValues(answer as ListNodeLike | null);
		else if (returns === 'TreeNode') out = treeList(answer as TreeNodeLike | null);
		else if (returns === 'TreeNodeVal') out = answer ? (answer as TreeNodeLike).val : null;
		else if (returns === 'ListNodeRef') {
			if (!answer) out = -1;
			else {
				const first = [...built.nodes.values()][0] ?? [];
				const at = first.indexOf(answer as ListNodeLike);
				if (at < 0) {
					throw new Error('The node you returned is not a node of the list you were given.');
				}
				out = at;
			}
		}
		if (out === undefined) {
			return { error: 'Your function returned undefined. Return the answer.' };
		}
		// A number that is not finite has no JSON form; Python would read NaN as a wrong answer too.
		const text = JSON.stringify(out);
		if (text === undefined) return { error: 'Your function returned something that is not data.' };
		return { out: JSON.parse(text), ms, reads: call.reads ? reads.count : null };
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}

export function runJsCalls(options: RunOptions): void {
	const { source, plan, now, log, emit } = options;
	let program: ReturnType<typeof loadProgram>;
	try {
		// The starter spells the function the way JavaScript does: two_sum becomes twoSum.
		program = loadProgram(source, ident('javascript', plan.function.name), log);
	} catch (err) {
		// The code did not even load: every call fails the same way, and the first one is the one shown.
		const message = err instanceof Error ? err.message : String(err);
		for (const call of plan.calls) emit(call.key, { error: message });
		return;
	}
	const { fn, ...classes } = program;

	let slow = false;
	for (const call of plan.calls) {
		if (call.unsupported) {
			emit(call.key, { unsupported: call.unsupported });
			continue;
		}
		if (call.perf && slow) {
			emit(call.key, { skip: true });
			continue;
		}
		const record = runOneCall(fn, plan, call, now, classes);
		if (call.perf && 'ms' in record && record.ms > call.limitMs) slow = true;
		emit(call.key, record);
	}
}
