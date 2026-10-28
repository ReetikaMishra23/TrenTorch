// Starter code for a DSA question in every language except Python (whose starter.py is hand-written).
// Built from the question's problem.json signature, so a student who switches language gets the same
// function in that language's syntax, plus a main() that calls it on the first example and prints the
// result: Run executes the file as a program, so that is what makes Run show something.
import type { DsaSignature } from '$data/curriculum/bundle-types';

export type StarterLanguage = 'javascript' | 'cpp' | 'java' | 'go' | 'rust';
export type LanguageStarters = Record<StarterLanguage, string>;

// A parsed type: a scalar, a (nested) list of a scalar, or a linked structure we know how to declare.
type Scalar = 'int' | 'float' | 'bool' | 'str';
type Shape =
	| { kind: 'scalar'; scalar: Scalar }
	| { kind: 'list'; depth: number; scalar: Scalar }
	| { kind: 'node'; node: 'TreeNode' | 'ListNode' };

function parseType(type: string): Shape | null {
	if (type === 'TreeNode' || type === 'ListNode') return { kind: 'node', node: type };
	let depth = 0;
	let rest = type;
	while (rest.startsWith('list[') && rest.endsWith(']')) {
		depth++;
		rest = rest.slice(5, -1);
	}
	if (rest !== 'int' && rest !== 'float' && rest !== 'bool' && rest !== 'str') return null;
	return depth === 0 ? { kind: 'scalar', scalar: rest } : { kind: 'list', depth, scalar: rest };
}

// A parameter called `mod`, `new` or `len` is fine in Python but a keyword somewhere else.
const RESERVED: Record<StarterLanguage, Set<string>> = {
	javascript: new Set(
		'await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return static super switch this throw true try typeof var void while with yield'.split(
			' '
		)
	),
	cpp: new Set(
		'alignas and asm auto bool break case catch char class const continue default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new not operator or private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while xor'.split(
			' '
		)
	),
	java: new Set(
		'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null'.split(
			' '
		)
	),
	go: new Set(
		'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var'.split(
			' '
		)
	),
	rust: new Set(
		'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self static struct super trait true type unsafe use where while abstract become box do final macro override priv try typeof unsized virtual yield'.split(
			' '
		)
	)
};

const camel = (snake: string) => snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

// The identifier to use in `lang` for a Python name.
function ident(lang: StarterLanguage, snake: string): string {
	const name = lang === 'rust' ? snake : camel(snake);
	return RESERVED[lang].has(name) ? `${name}_` : name;
}

// One table per language instead of five near-identical switch statements.
interface Syntax {
	scalar: Record<Scalar, string>;
	list: (inner: string) => string;
	node: Record<'TreeNode' | 'ListNode', string>;
	zero: (shape: Shape) => string;
}

const SYNTAX: Record<Exclude<StarterLanguage, 'javascript'>, Syntax> = {
	cpp: {
		// `int`, not `long long`: the C++ runtime is an interpreter (JSCPP) with a smaller type set.
		scalar: { int: 'int', float: 'double', bool: 'bool', str: 'string' },
		list: (inner) => `vector<${inner}>`,
		node: { TreeNode: 'TreeNode*', ListNode: 'ListNode*' },
		zero: (shape) =>
			shape.kind === 'node'
				? 'nullptr'
				: shape.kind === 'list'
					? '{}'
					: shape.scalar === 'str'
						? '""'
						: shape.scalar === 'bool'
							? 'false'
							: '0'
	},
	java: {
		scalar: { int: 'long', float: 'double', bool: 'boolean', str: 'String' },
		list: (inner) => `${inner}[]`,
		node: { TreeNode: 'TreeNode', ListNode: 'ListNode' },
		zero: (shape) =>
			shape.kind === 'scalar' && shape.scalar !== 'str'
				? shape.scalar === 'bool'
					? 'false'
					: '0'
				: 'null'
	},
	go: {
		scalar: { int: 'int', float: 'float64', bool: 'bool', str: 'string' },
		list: (inner) => `[]${inner}`,
		node: { TreeNode: '*TreeNode', ListNode: '*ListNode' },
		zero: (shape) =>
			shape.kind === 'scalar'
				? shape.scalar === 'str'
					? '""'
					: shape.scalar === 'bool'
						? 'false'
						: '0'
				: 'nil'
	},
	rust: {
		scalar: { int: 'i64', float: 'f64', bool: 'bool', str: 'String' },
		list: (inner) => `Vec<${inner}>`,
		node: { TreeNode: 'Option<Box<TreeNode>>', ListNode: 'Option<Box<ListNode>>' },
		zero: () => 'todo!()'
	}
};

function typeName(lang: keyof typeof SYNTAX, shape: Shape): string {
	const syntax = SYNTAX[lang];
	if (shape.kind === 'node') return syntax.node[shape.node];
	let name = syntax.scalar[shape.scalar];
	if (shape.kind === 'list') for (let i = 0; i < shape.depth; i++) name = syntax.list(name);
	return name;
}

// An example input as a literal in the target language. Nodes are not given (their JSON is a
// level-order array that needs a builder), so a signature that takes one has no example call.
function literal(lang: StarterLanguage, shape: Shape, value: unknown): string | null {
	if (shape.kind === 'node') return null;
	if (shape.kind === 'scalar') return scalarLiteral(lang, shape.scalar, value);
	if (!Array.isArray(value)) return null;
	const items = value.map((v) =>
		shape.depth > 1
			? literal(lang, { kind: 'list', depth: shape.depth - 1, scalar: shape.scalar }, v)
			: scalarLiteral(lang, shape.scalar, v)
	);
	if (items.some((item) => item === null)) return null;
	const body = items.join(', ');
	if (lang === 'javascript') return `[${body}]`;
	const full = typeName(lang, shape);
	switch (lang) {
		case 'cpp':
			return `${full}{${body}}`;
		case 'java':
			// Nested array initialisers only take the bare `{...}` form.
			return `new ${full}{${body}}`;
		case 'go':
			return `${full}{${body}}`;
		case 'rust':
			return `vec![${body}]`;
	}
}

function scalarLiteral(lang: StarterLanguage, scalar: Scalar, value: unknown): string | null {
	if (scalar === 'bool') return typeof value === 'boolean' ? String(value) : null;
	if (scalar === 'str') return typeof value === 'string' ? stringLiteral(lang, value) : null;
	if (typeof value !== 'number') return null;
	if (scalar === 'float') {
		return Number.isInteger(value) ? `${value}.0` : String(value);
	}
	return lang === 'java' ? `${value}L` : String(value);
}

function stringLiteral(lang: StarterLanguage, value: string): string {
	const quoted = JSON.stringify(value);
	return lang === 'rust' ? `String::from(${quoted})` : quoted;
}

const NODE_DECLARATIONS: Record<
	Exclude<StarterLanguage, 'javascript'>,
	Record<'TreeNode' | 'ListNode', string>
> = {
	cpp: {
		TreeNode: 'struct TreeNode {\n    int val;\n    TreeNode* left;\n    TreeNode* right;\n};',
		ListNode: 'struct ListNode {\n    int val;\n    ListNode* next;\n};'
	},
	java: {
		TreeNode:
			'class TreeNode {\n    long val;\n    TreeNode left, right;\n    TreeNode(long val) { this.val = val; }\n}',
		ListNode:
			'class ListNode {\n    long val;\n    ListNode next;\n    ListNode(long val) { this.val = val; }\n}'
	},
	go: {
		TreeNode: 'type TreeNode struct {\n\tVal         int\n\tLeft, Right *TreeNode\n}',
		ListNode: 'type ListNode struct {\n\tVal  int\n\tNext *ListNode\n}'
	},
	rust: {
		TreeNode:
			'#[derive(Debug)]\nstruct TreeNode {\n    val: i64,\n    left: Option<Box<TreeNode>>,\n    right: Option<Box<TreeNode>>,\n}',
		ListNode:
			'#[derive(Debug)]\nstruct ListNode {\n    val: i64,\n    next: Option<Box<ListNode>>,\n}'
	}
};

const JS_NODES: Record<'TreeNode' | 'ListNode', string> = {
	TreeNode:
		'class TreeNode {\n  constructor(val = 0, left = null, right = null) {\n    this.val = val;\n    this.left = left;\n    this.right = right;\n  }\n}',
	ListNode:
		'class ListNode {\n  constructor(val = 0, next = null) {\n    this.val = val;\n    this.next = next;\n  }\n}'
};

interface Prepared {
	name: string;
	params: { name: string; shape: Shape }[];
	returns: Shape;
	nodes: ('TreeNode' | 'ListNode')[];
	// null when an input has no literal form (a node, or a type outside the table).
	args: Record<StarterLanguage, string[]> | null;
}

function prepare(signature: DsaSignature): Prepared | null {
	const params = signature.params.map((p) => ({ name: p.name, shape: parseType(p.type) }));
	const returns = parseType(signature.returns);
	if (!returns || params.some((p) => !p.shape)) return null;
	const shapes = params as { name: string; shape: Shape }[];
	const nodes = new Set<'TreeNode' | 'ListNode'>();
	for (const shape of [returns, ...shapes.map((p) => p.shape)]) {
		if (shape.kind === 'node') nodes.add(shape.node);
	}
	let args: Prepared['args'] = null;
	if (signature.example) {
		const built: Record<StarterLanguage, string[]> = {
			javascript: [],
			cpp: [],
			java: [],
			go: [],
			rust: []
		};
		let ok = true;
		for (const p of shapes) {
			for (const lang of Object.keys(built) as StarterLanguage[]) {
				const text = literal(lang, p.shape, signature.example[p.name]);
				if (text === null) ok = false;
				else built[lang].push(text);
			}
		}
		if (ok) args = built;
	}
	return { name: signature.name, params: shapes, returns, nodes: [...nodes], args };
}

function javascript(p: Prepared): string {
	const fn = ident('javascript', p.name);
	const params = p.params.map((q) => ident('javascript', q.name)).join(', ');
	const parts = p.nodes.map((n) => JS_NODES[n]);
	parts.push(`function ${fn}(${params}) {\n  // TODO: write your solution here\n}`);
	// Run executes the file with no test harness, so print a sample call.
	parts.push(
		p.args
			? `console.log(${fn}(${p.args.javascript.join(', ')}));`
			: `// Call ${fn}(...) here and console.log the result to try it.`
	);
	return `${parts.join('\n\n')}\n`;
}

function cpp(p: Prepared): string {
	const fn = ident('cpp', p.name);
	const sig = p.params.map((q) => `${typeName('cpp', q.shape)} ${ident('cpp', q.name)}`).join(', ');
	const ret = typeName('cpp', p.returns);
	const body = `${ret} ${fn}(${sig}) {\n    // TODO: write your solution here\n    return ${SYNTAX.cpp.zero(p.returns)};\n}`;
	const parts = [
		'#include <iostream>',
		'#include <vector>',
		'#include <string>',
		'using namespace std;'
	];
	const nodes = p.nodes.map((n) => NODE_DECLARATIONS.cpp[n]);
	let main = 'int main() {\n    // Call it here and print the result to try it.\n    return 0;\n}';
	if (p.args) {
		const call = `${fn}(${p.args.cpp.join(', ')})`;
		const print =
			p.returns.kind === 'list' && p.returns.depth === 1
				? `    vector<${SYNTAX.cpp.scalar[p.returns.scalar]}> result = ${call};\n    for (size_t i = 0; i < result.size(); i++) cout << result[i] << " ";\n    cout << endl;`
				: p.returns.kind === 'scalar'
					? `    cout << ${call} << endl;`
					: `    ${call};`;
		main = `int main() {\n${print}\n    return 0;\n}`;
	}
	return `${parts.join('\n')}\n\n${[...nodes, body, main].join('\n\n')}\n`;
}

function java(p: Prepared): string {
	const fn = ident('java', p.name);
	const sig = p.params
		.map((q) => `${typeName('java', q.shape)} ${ident('java', q.name)}`)
		.join(', ');
	const ret = typeName('java', p.returns);
	const nodes = p.nodes.map((n) => NODE_DECLARATIONS.java[n]);
	let call = '        // Call it here and print the result to try it.';
	if (p.args) {
		const invoke = `${fn}(${p.args.java.join(', ')})`;
		call =
			p.returns.kind === 'list'
				? `        System.out.println(java.util.Arrays.${p.returns.depth > 1 ? 'deepToString' : 'toString'}(${invoke}));`
				: p.returns.kind === 'scalar'
					? `        System.out.println(${invoke});`
					: `        ${invoke};`;
	}
	const cls = `public class Main {\n    static ${ret} ${fn}(${sig}) {\n        // TODO: write your solution here\n        return ${SYNTAX.java.zero(p.returns)};\n    }\n\n    public static void main(String[] args) {\n${call}\n    }\n}`;
	return `${[...nodes, cls].join('\n\n')}\n`;
}

function go(p: Prepared): string {
	const fn = ident('go', p.name);
	const sig = p.params.map((q) => `${ident('go', q.name)} ${typeName('go', q.shape)}`).join(', ');
	const ret = typeName('go', p.returns);
	const nodes = p.nodes.map((n) => NODE_DECLARATIONS.go[n]);
	const body = `func ${fn}(${sig}) ${ret} {\n\t// TODO: write your solution here\n\treturn ${SYNTAX.go.zero(p.returns)}\n}`;
	const call = p.args
		? `\tfmt.Println(${fn}(${p.args.go.join(', ')}))`
		: '\t// Call it here and print the result to try it.';
	const main = `func main() {\n${call}\n}`;
	const header = p.args ? 'package main\n\nimport "fmt"' : 'package main';
	return `${header}\n\n${[...nodes, body, main].join('\n\n')}\n`;
}

function rust(p: Prepared): string {
	const fn = ident('rust', p.name);
	const sig = p.params
		.map((q) => `${ident('rust', q.name)}: ${typeName('rust', q.shape)}`)
		.join(', ');
	const ret = typeName('rust', p.returns);
	const nodes = p.nodes.map((n) => NODE_DECLARATIONS.rust[n]);
	const body = `fn ${fn}(${sig}) -> ${ret} {\n    // TODO: write your solution here\n    ${SYNTAX.rust.zero(p.returns)}\n}`;
	const main = `fn main() {\n    ${
		p.args
			? `println!("{:?}", ${fn}(${p.args.rust.join(', ')}));`
			: '// Call it here and print the result to try it.'
	}\n}`;
	return `${[...nodes, body, main].join('\n\n')}\n`;
}

// A signature using a type outside the table (a bare `list`, `ListNodeRef`, ...) still gets a
// starter, just without a typed function: the student reads the statement for what to write.
function fallback(lang: StarterLanguage, name: string): string {
	const fn = ident(lang, name);
	const note = `Write ${fn} as the problem statement describes.`;
	switch (lang) {
		case 'javascript':
			return `// ${note}\nfunction ${fn}() {\n  // TODO: write your solution here\n}\n`;
		case 'cpp':
			return `#include <iostream>\nusing namespace std;\n\n// ${note}\n\nint main() {\n    return 0;\n}\n`;
		case 'java':
			return `public class Main {\n    // ${note}\n\n    public static void main(String[] args) {\n    }\n}\n`;
		case 'go':
			return `package main\n\n// ${note}\n\nfunc main() {\n}\n`;
		case 'rust':
			return `// ${note}\n\nfn main() {\n}\n`;
	}
}

export function buildLanguageStarters(signature: DsaSignature): LanguageStarters {
	const prepared = prepare(signature);
	if (!prepared) {
		return {
			javascript: fallback('javascript', signature.name),
			cpp: fallback('cpp', signature.name),
			java: fallback('java', signature.name),
			go: fallback('go', signature.name),
			rust: fallback('rust', signature.name)
		};
	}
	return {
		javascript: javascript(prepared),
		cpp: cpp(prepared),
		java: java(prepared),
		go: go(prepared),
		rust: rust(prepared)
	};
}
