import { ident, parseType, typeName, type Shape } from '../ide-content/build-language-starters';
import type { ExternalFunction } from './external-protocol';

// The Java members that run a submission (see external-codec.ts for the text they read and write). They are
// put inside the student's own `class Main`, on the same line as its opening brace so the line numbers in a
// compile error stay the student's, and their main() is renamed. CheerpJ gives no way to read stdout while
// the program runs, so each answer is appended to a results file that the worker reads as it grows.

export const JAVA_INPUT_FILE = '/str/calls.txt';
export const javaResultsFile = (code: string) => `/files/${code}.txt`;

const key = (shape: Shape): string =>
	shape.kind === 'node'
		? shape.node
		: shape.kind === 'list'
			? `L${shape.depth}_${shape.scalar}`
			: shape.scalar;
const jt = (shape: Shape) => typeName('java', shape);

function elementOf(shape: Shape): Shape {
	if (shape.kind !== 'list') throw new Error('not a list');
	return shape.depth > 1
		? { kind: 'list', depth: shape.depth - 1, scalar: shape.scalar }
		: { kind: 'scalar', scalar: shape.scalar };
}

function helpers(shape: Shape, seen: Set<string>, out: string[]): void {
	const k = key(shape);
	if (seen.has(k) || shape.kind !== 'list') return;
	seen.add(k);
	const inner = elementOf(shape);
	helpers(inner, seen, out);
	const t = jt(shape);
	const innerT = jt(inner);
	// Java cannot make a generic array, so the outer dimension is made and each row is filled in.
	const scalarT = jt({ kind: 'scalar', scalar: shape.scalar });
	const make = `new ${scalarT}[n]${'[]'.repeat(shape.depth - 1)}`;
	out.push(`static ${t} tt_rd_${k}() { int n = (int) tt_rd_int(); ${t} r = ${make}; for (int i = 0; i < n; i++) r[i] = tt_rd_${key(inner)}(); return r; }
static void tt_wr_${k}(StringBuilder b, ${t} v) { b.append(' ').append(v.length); for (${innerT} x : v) tt_wr_${key(inner)}(b, x); }`);
}

const SCALARS = `static String[] tt_toks; static int tt_pos;
static String tt_next() { return tt_toks[tt_pos++]; }
static long tt_rd_int() { return Long.parseLong(tt_next()); }
static double tt_rd_float() { return Double.parseDouble(tt_next()); }
static boolean tt_rd_bool() { return tt_next().equals("1"); }
static String tt_rd_str() { String t = tt_next(); java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream(); for (int i = 1; i < t.length(); i++) { char c = t.charAt(i); if (c == '%') { o.write(Integer.parseInt(t.substring(i + 1, i + 3), 16)); i += 2; } else o.write(c); } try { return new String(o.toByteArray(), "UTF-8"); } catch (Exception e) { return ""; } }
static void tt_wr_int(StringBuilder b, long v) { b.append(' ').append(v); }
static void tt_wr_float(StringBuilder b, double v) { b.append(' ').append(v); }
static void tt_wr_bool(StringBuilder b, boolean v) { b.append(v ? " 1" : " 0"); }
static void tt_wr_str(StringBuilder b, String v) { b.append(" s"); try { for (byte x : v.getBytes("UTF-8")) { int c = x & 255; if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) b.append((char) c); else b.append(String.format("%%%02X", c)); } } catch (Exception e) { } }`;

const LIST_NODE = `static ListNode[][] tt_built = new ListNode[16][];
static ListNode tt_rd_ListNode(int param) { int n = (int) tt_rd_int(); ListNode[] nodes = new ListNode[n]; for (int i = 0; i < n; i++) nodes[i] = new ListNode(tt_rd_int()); for (int i = 0; i + 1 < n; i++) nodes[i].next = nodes[i + 1]; long cycle = tt_rd_int(), jp = tt_rd_int(), ja = tt_rd_int(); if (jp >= 0 && n > 0 && tt_built[(int) jp] != null && ja < tt_built[(int) jp].length) nodes[n - 1].next = tt_built[(int) jp][(int) ja]; if (cycle >= 0 && n > 0) nodes[n - 1].next = nodes[(int) cycle]; tt_built[param] = nodes; return n == 0 ? null : nodes[0]; }
static void tt_wr_ListNode(StringBuilder b, ListNode head) { java.util.ArrayList<Long> vals = new java.util.ArrayList<Long>(); java.util.IdentityHashMap<ListNode, Boolean> seen = new java.util.IdentityHashMap<ListNode, Boolean>(); for (ListNode n = head; n != null; n = n.next) { if (seen.put(n, true) != null) throw new RuntimeException("Your answer is a list that loops back on itself. Check the last next pointer."); vals.add(n.val); } b.append(' ').append(vals.size()); for (long v : vals) b.append(' ').append(v); }`;

const TREE_NODE = `static TreeNode tt_rd_TreeNode() { int n = (int) tt_rd_int(); String[] items = new String[n]; for (int i = 0; i < n; i++) items[i] = tt_next(); if (n == 0 || items[0].equals("_")) return null; TreeNode root = new TreeNode(Long.parseLong(items[0])); java.util.ArrayList<TreeNode> queue = new java.util.ArrayList<TreeNode>(); queue.add(root); int next = 1; for (int q = 0; q < queue.size(); q++) { if (next < n) { String s = items[next++]; if (!s.equals("_")) { queue.get(q).left = new TreeNode(Long.parseLong(s)); queue.add(queue.get(q).left); } } if (next < n) { String s = items[next++]; if (!s.equals("_")) { queue.get(q).right = new TreeNode(Long.parseLong(s)); queue.add(queue.get(q).right); } } } return root; }
static void tt_wr_TreeNode(StringBuilder b, TreeNode root) { java.util.ArrayList<TreeNode> queue = new java.util.ArrayList<TreeNode>(); queue.add(root); java.util.IdentityHashMap<TreeNode, Boolean> seen = new java.util.IdentityHashMap<TreeNode, Boolean>(); java.util.ArrayList<String> items = new java.util.ArrayList<String>(); for (int q = 0; q < queue.size(); q++) { TreeNode n = queue.get(q); if (n == null) { items.add("_"); continue; } if (seen.put(n, true) != null) throw new RuntimeException("Your answer is not a tree: the same node appears twice."); items.add(Long.toString(n.val)); queue.add(n.left); queue.add(n.right); } while (!items.isEmpty() && items.get(items.size() - 1).equals("_")) items.remove(items.size() - 1); b.append(' ').append(items.size()); for (String s : items) b.append(' ').append(s); }`;

export function buildJavaDriver(
	source: string,
	fn: ExternalFunction,
	code: string,
	paths: { input: string; results: string } = {
		input: JAVA_INPUT_FILE,
		results: javaResultsFile(code)
	}
): string {
	const name = ident('java', fn.name);
	const shapes = fn.params.map((p) => parseType(p.type)!);
	const returns = parseType(fn.returns)!;
	const all = [...shapes, returns];
	const pieces: string[] = [];
	const seen = new Set<string>();
	const hasList = all.some((s) => s.kind === 'node' && s.node === 'ListNode');
	const hasTree = all.some((s) => s.kind === 'node' && s.node === 'TreeNode');
	for (const s of hasList ? [...all, parseType('list[int]')!] : all) helpers(s, seen, pieces);
	const declare = shapes
		.map(
			(s, i) =>
				`${jt(s)} a${i} = ${s.kind === 'node' && s.node === 'ListNode' ? `tt_rd_ListNode(${i})` : `tt_rd_${key(s)}()`};`
		)
		.join(' ');

	const members = [
		SCALARS,
		hasList ? LIST_NODE : '',
		hasTree ? TREE_NODE : '',
		...pieces,
		`static final String TT_CODE = ${JSON.stringify(code)}; static final String TT_RESULTS = ${JSON.stringify(paths.results)};`,
		// The whole file is written each time: CheerpJ ignores append mode, and the lines are short.
		`static StringBuilder tt_all = new StringBuilder(); static void tt_emit(String line) { tt_all.append(line).append('\\n'); try (java.io.FileOutputStream f = new java.io.FileOutputStream(TT_RESULTS)) { f.write(tt_all.toString().getBytes("UTF-8")); } catch (Exception e) { System.err.println("tt_emit failed: " + e); } }`,
		`static void tt_run() throws Exception { byte[] raw = java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(${JSON.stringify(paths.input)})); tt_toks = new String(raw, "UTF-8").trim().split("\\\\s+"); tt_emit(TT_CODE + " start"); int calls = (int) tt_rd_int(); boolean slow = false; for (int c = 0; c < calls; c++) { int id = (int) tt_rd_int(); boolean perf = tt_rd_int() == 1; long limit = tt_rd_int(); ${hasList ? 'tt_built = new ListNode[16][]; ' : ''}${declare} if (perf && slow) { tt_emit(TT_CODE + " " + id + " skip"); continue; } try { long t0 = System.nanoTime(); ${jt(returns)} answer = ${name}(${shapes.map((_, i) => `a${i}`).join(', ')}); double ms = (System.nanoTime() - t0) / 1e6; if (perf && ms > limit) slow = true; StringBuilder b = new StringBuilder(); tt_wr_${key(returns)}(b, answer); tt_emit(TT_CODE + " " + id + " ok " + String.format(java.util.Locale.ROOT, "%.3f", ms) + b); } catch (Throwable t) { StringBuilder b = new StringBuilder(); tt_wr_str(b, String.valueOf(t)); tt_emit(TT_CODE + " " + id + " err" + b); } } }`,
		`public static void main(String[] ttArgs) throws Exception { tt_run(); }`
	]
		.filter(Boolean)
		.join(' ')
		.replace(/\n/g, ' ');

	// Our main() replaces the student's, which stays as a method nobody calls.
	const renamed = source.replace(/\bvoid\s+main\s*\(/, 'void ttStudentMain(');
	const classOpen = /\bclass\s+Main\b[^{]*\{/;
	if (!classOpen.test(renamed)) {
		throw new Error('Your code needs a class named Main that holds the function.');
	}
	return renamed.replace(classOpen, (open) => `${open} ${members} `);
}
