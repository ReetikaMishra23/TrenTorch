import { ident, parseType, typeName, type Shape } from '../ide-content/build-language-starters';
import type { ExternalFunction } from './external-protocol';

// The Go program that runs a submission (see external-codec.ts for the text it reads and writes). The
// student's file stays as it is, with its own main() renamed, and this driver's main() is added. Yaegi runs
// main() by itself when it evaluates the source, and hands back everything printed when it ends, so the
// worker runs one test case at a time (see typed-run.ts) and the data for it is part of the source.

const key = (shape: Shape): string =>
	shape.kind === 'node'
		? shape.node
		: shape.kind === 'list'
			? `L${shape.depth}_${shape.scalar}`
			: shape.scalar;

const goType = (shape: Shape) => typeName('go', shape);

function elementOf(shape: Shape): Shape {
	if (shape.kind !== 'list') throw new Error('not a list');
	return shape.depth > 1
		? { kind: 'list', depth: shape.depth - 1, scalar: shape.scalar }
		: { kind: 'scalar', scalar: shape.scalar };
}

// The read and write helpers a shape needs, and the ones the shapes inside it need.
function helpers(shape: Shape, seen: Set<string>, out: string[]): void {
	const k = key(shape);
	if (seen.has(k)) return;
	seen.add(k);
	if (shape.kind === 'list') {
		const inner = elementOf(shape);
		helpers(inner, seen, out);
		const t = goType(shape);
		out.push(`func tt_rd_${k}() ${t} {
	n := tt_rd_int()
	r := make(${t}, 0, n)
	for i := 0; i < n; i++ {
		r = append(r, tt_rd_${key(inner)}())
	}
	return r
}
func tt_wr_${k}(b *tt_strings.Builder, v ${t}) string {
	b.WriteString(" " + tt_strconv.Itoa(len(v)))
	for _, x := range v {
		if e := tt_wr_${key(inner)}(b, x); e != "" {
			return e
		}
	}
	return ""
}`);
	}
}

const SCALARS = `func tt_rd_int() int {
	v, _ := tt_strconv.ParseInt(tt_next(), 10, 64)
	return int(v)
}
func tt_rd_float() float64 {
	v, _ := tt_strconv.ParseFloat(tt_next(), 64)
	return v
}
func tt_rd_bool() bool { return tt_next() == "1" }
func tt_rd_str() string {
	t := tt_next()
	var r []byte
	for i := 1; i < len(t); i++ {
		if t[i] == '%' {
			v, _ := tt_strconv.ParseUint(t[i+1:i+3], 16, 8)
			r = append(r, byte(v))
			i += 2
		} else {
			r = append(r, t[i])
		}
	}
	return string(r)
}
func tt_wr_int(b *tt_strings.Builder, v int) string {
	b.WriteString(" " + tt_strconv.Itoa(v))
	return ""
}
func tt_wr_float(b *tt_strings.Builder, v float64) string {
	b.WriteString(" " + tt_strconv.FormatFloat(v, 'g', -1, 64))
	return ""
}
func tt_wr_bool(b *tt_strings.Builder, v bool) string {
	if v {
		b.WriteString(" 1")
	} else {
		b.WriteString(" 0")
	}
	return ""
}
func tt_wr_str(b *tt_strings.Builder, v string) string {
	b.WriteString(" s")
	for i := 0; i < len(v); i++ {
		c := v[i]
		if (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') {
			b.WriteByte(c)
		} else {
			b.WriteString("%" + tt_strings.ToUpper(tt_strconv.FormatUint(uint64(c)+256, 16)[1:]))
		}
	}
	return ""
}`;

const LIST_NODE = `var tt_built [][]*ListNode
func tt_rd_ListNode(param int) *ListNode {
	n := tt_rd_int()
	nodes := make([]*ListNode, 0, n)
	for i := 0; i < n; i++ {
		nodes = append(nodes, &ListNode{Val: tt_rd_int()})
	}
	for i := 0; i+1 < len(nodes); i++ {
		nodes[i].Next = nodes[i+1]
	}
	cycle, joinParam, joinAt := tt_rd_int(), tt_rd_int(), tt_rd_int()
	if joinParam >= 0 && len(nodes) > 0 && joinParam < len(tt_built) && joinAt < len(tt_built[joinParam]) {
		nodes[len(nodes)-1].Next = tt_built[joinParam][joinAt]
	}
	if cycle >= 0 && len(nodes) > 0 {
		nodes[len(nodes)-1].Next = nodes[cycle]
	}
	for len(tt_built) <= param {
		tt_built = append(tt_built, nil)
	}
	tt_built[param] = nodes
	if len(nodes) == 0 {
		return nil
	}
	return nodes[0]
}
func tt_wr_ListNode(b *tt_strings.Builder, head *ListNode) string {
	var values []int
	seen := map[*ListNode]bool{}
	for n := head; n != nil; n = n.Next {
		if seen[n] {
			return "Your answer is a list that loops back on itself. Check the last next pointer."
		}
		seen[n] = true
		values = append(values, n.Val)
	}
	return tt_wr_L1_int(b, values)
}`;

const TREE_NODE = `func tt_rd_TreeNode() *TreeNode {
	n := tt_rd_int()
	items := make([]string, 0, n)
	for i := 0; i < n; i++ {
		items = append(items, tt_next())
	}
	if len(items) == 0 || items[0] == "_" {
		return nil
	}
	mk := func(s string) *TreeNode {
		v, _ := tt_strconv.Atoi(s)
		return &TreeNode{Val: v}
	}
	root := mk(items[0])
	queue := []*TreeNode{root}
	next := 1
	for q := 0; q < len(queue); q++ {
		if next < len(items) {
			next++
			if items[next-1] != "_" {
				queue[q].Left = mk(items[next-1])
				queue = append(queue, queue[q].Left)
			}
		}
		if next < len(items) {
			next++
			if items[next-1] != "_" {
				queue[q].Right = mk(items[next-1])
				queue = append(queue, queue[q].Right)
			}
		}
	}
	return root
}
func tt_wr_TreeNode(b *tt_strings.Builder, root *TreeNode) string {
	queue := []*TreeNode{root}
	seen := map[*TreeNode]bool{}
	var items []string
	for q := 0; q < len(queue); q++ {
		n := queue[q]
		if n == nil {
			items = append(items, "_")
			continue
		}
		if seen[n] {
			return "Your answer is not a tree: the same node appears twice."
		}
		seen[n] = true
		items = append(items, tt_strconv.Itoa(n.Val))
		queue = append(queue, n.Left, n.Right)
	}
	for len(items) > 0 && items[len(items)-1] == "_" {
		items = items[:len(items)-1]
	}
	b.WriteString(" " + tt_strconv.Itoa(len(items)))
	for _, s := range items {
		b.WriteString(" " + s)
	}
	return ""
}`;

/** The text of a string as a Go literal: only the characters of the data (see external-codec.ts), so no escapes. */
const dataLiteral = (text: string) => JSON.stringify(text.replace(/\n/g, ' '));

export function buildGoDriver(
	source: string,
	fn: ExternalFunction,
	code: string,
	input: string
): string {
	const name = ident('go', fn.name);
	const shapes = fn.params.map((p) => parseType(p.type)!);
	const returns = parseType(fn.returns)!;
	const pieces: string[] = [];
	const seen = new Set<string>();
	const hasList = [...shapes, returns].some((s) => s.kind === 'node' && s.node === 'ListNode');
	// A returned list is written as the list of its values.
	const wanted = hasList ? [...shapes, returns, parseType('list[int]')!] : [...shapes, returns];
	for (const s of wanted) helpers(s, seen, pieces);
	const hasTree = [...shapes, returns].some((s) => s.kind === 'node' && s.node === 'TreeNode');
	const read = (s: Shape, i: number) =>
		s.kind === 'node' && s.node === 'ListNode' ? `tt_rd_ListNode(${i})` : `tt_rd_${key(s)}()`;
	const declare = shapes.map((s, i) => `\t\ta${i} := ${read(s, i)}`).join('\n');
	const args = shapes.map((_, i) => `a${i}`).join(', ');

	const driver = `
${SCALARS}
${hasList ? LIST_NODE : ''}
${hasTree ? TREE_NODE : ''}
${pieces.join('\n')}
const tt_data = ${dataLiteral(input)}
const tt_code = ${JSON.stringify(code)}
var tt_toks []string
var tt_pos int
func tt_next() string {
	t := tt_toks[tt_pos]
	tt_pos++
	return t
}
func tt_call(id int, f func() (float64, string)) {
	ms := 0.0
	msg := ""
	func() {
		defer func() {
			if r := recover(); r != nil {
				msg = tt_fmt.Sprint(r)
				if msg == "" {
					msg = "panic"
				}
			}
		}()
		ms, msg = f()
	}()
	if msg != "" {
		var b tt_strings.Builder
		tt_wr_str(&b, msg)
		tt_fmt.Println(tt_code + " " + tt_strconv.Itoa(id) + " err" + b.String())
	}
	_ = ms
}
func main() {
	tt_toks = tt_strings.Fields(tt_data)
	calls := tt_rd_int()
	for c := 0; c < calls; c++ {
		id := tt_rd_int()
		tt_rd_int()
		tt_rd_int()
${hasList ? '\t\ttt_built = nil' : ''}
${declare}
		tt_call(id, func() (float64, string) {
			started := tt_time.Now()
			answer := ${name}(${args})
			ms := float64(tt_time.Since(started).Nanoseconds()) / 1e6
			var b tt_strings.Builder
			if e := tt_wr_${key(returns)}(&b, answer); e != "" {
				return ms, e
			}
			tt_fmt.Println(tt_code + " " + tt_strconv.Itoa(id) + " ok " + tt_strconv.FormatFloat(ms, 'f', 3, 64) + b.String())
			return ms, ""
		})
	}
}
`;
	// Imports must come before the first declaration. They are aliased so they cannot clash with the
	// student's own, and kept on the package line so the line numbers in an error stay the student's.
	const imports =
		'import (tt_fmt "fmt"; tt_strconv "strconv"; tt_strings "strings"; tt_time "time")';
	const renamed = source.replace(/\bfunc\s+main\s*\(\s*\)/, 'func tt_student_main()');
	const withImports = /^\s*package\s+main\b.*$/m.test(renamed)
		? renamed.replace(/^(\s*package\s+main\b.*)$/m, `$1; ${imports}`)
		: `package main; ${imports}\n${renamed}`;
	return withImports + driver;
}
