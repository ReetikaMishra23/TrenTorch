import { ident, parseType } from '../ide-content/build-language-starters';
import type { ExternalFunction } from './external-protocol';

// The C++ program that runs a submission (see external-codec.ts for the text it reads and writes). The
// student's file is kept as it is, with its own main() renamed out of the way, and this driver's main()
// is added after it: it reads every call from /sandbox/calls.txt, calls the student's function, times it,
// and prints one line per answer.

export const CPP_INPUT_FILE = '/sandbox/calls.txt';

function usesNode(fn: ExternalFunction, node: string): boolean {
	return [...fn.params.map((p) => p.type), fn.returns].includes(node);
}

export function buildCppDriver(source: string, fn: ExternalFunction, code: string): string {
	const name = ident('cpp', fn.name);
	const args = fn.params.map((_, i) => `tt_a${i}`);
	const declare = fn.params
		.map((p, i) => {
			const shape = parseType(p.type)!;
			const type =
				shape.kind === 'node'
					? shape.node === 'ListNode'
						? 'ListNode*'
						: 'TreeNode*'
					: cppType(shape);
			return `        ${type} tt_a${i}{}; tt_rdp(tt_a${i}, ${i});`;
		})
		.join('\n');
	const list = usesNode(fn, 'ListNode');
	const tree = usesNode(fn, 'TreeNode');

	const driver = `
namespace trentorch_driver {
static std::string tt_data;
static size_t tt_at = 0;
static std::string tt_error;
${list ? 'static std::vector<std::vector<ListNode*>> tt_built;' : ''}

static std::string tt_tok() {
    while (tt_at < tt_data.size() && isspace((unsigned char)tt_data[tt_at])) tt_at++;
    size_t from = tt_at;
    while (tt_at < tt_data.size() && !isspace((unsigned char)tt_data[tt_at])) tt_at++;
    return tt_data.substr(from, tt_at - from);
}
static void tt_rd(long long& x) { x = strtoll(tt_tok().c_str(), nullptr, 10); }
static void tt_rd(double& x) { x = strtod(tt_tok().c_str(), nullptr); }
static void tt_rd(bool& x) { x = tt_tok() == "1"; }
static void tt_rd(std::string& x) {
    std::string t = tt_tok();
    x.clear();
    for (size_t i = 1; i < t.size(); i++) {
        if (t[i] == '%') { x += (char)strtol(t.substr(i + 1, 2).c_str(), nullptr, 16); i += 2; }
        else x += t[i];
    }
}
template <class T> static void tt_rd(std::vector<T>& v) {
    long long n; tt_rd(n);
    v.clear();
    for (long long i = 0; i < n; i++) { T x{}; tt_rd(x); v.push_back(x); }
}
template <class T> static void tt_rdp(T& x, int) { tt_rd(x); }
${
	list
		? `static void tt_rdp(ListNode*& head, int param) {
    std::vector<long long> values; tt_rd(values);
    long long cycle, joinParam, joinAt; tt_rd(cycle); tt_rd(joinParam); tt_rd(joinAt);
    std::vector<ListNode*> nodes;
    for (long long v : values) nodes.push_back(new ListNode((int)v));
    for (size_t i = 0; i + 1 < nodes.size(); i++) nodes[i]->next = nodes[i + 1];
    if (joinParam >= 0 && !nodes.empty() && joinParam < (long long)tt_built.size() &&
        joinAt < (long long)tt_built[joinParam].size()) nodes.back()->next = tt_built[joinParam][joinAt];
    if (cycle >= 0 && !nodes.empty()) nodes.back()->next = nodes[cycle];
    if ((int)tt_built.size() <= param) tt_built.resize(param + 1);
    tt_built[param] = nodes;
    head = nodes.empty() ? nullptr : nodes[0];
}`
		: ''
}
${
	tree
		? `static void tt_rdp(TreeNode*& root, int) {
    long long n; tt_rd(n);
    std::vector<std::string> items;
    for (long long i = 0; i < n; i++) items.push_back(tt_tok());
    root = nullptr;
    if (items.empty() || items[0] == "_") return;
    root = new TreeNode(atoi(items[0].c_str()));
    std::vector<TreeNode*> queue{root};
    size_t next = 1;
    for (size_t q = 0; q < queue.size(); q++) {
        if (next < items.size() && items[next++] != "_") { queue[q]->left = new TreeNode(atoi(items[next - 1].c_str())); queue.push_back(queue[q]->left); }
        if (next < items.size() && items[next++] != "_") { queue[q]->right = new TreeNode(atoi(items[next - 1].c_str())); queue.push_back(queue[q]->right); }
    }
}`
		: ''
}

static void tt_wr(std::string& out, long long x) { out += " " + std::to_string(x); }
static void tt_wr(std::string& out, int x) { out += " " + std::to_string(x); }
static void tt_wr(std::string& out, double x) {
    if (!std::isfinite(x)) { tt_error = "Your answer is not a finite number."; return; }
    char buf[40]; snprintf(buf, sizeof buf, " %.17g", x); out += buf;
}
static void tt_wr(std::string& out, bool x) { out += x ? " 1" : " 0"; }
static void tt_wr(std::string& out, const std::string& x) {
    out += " s";
    for (unsigned char c : x) {
        if (isalnum(c)) out += (char)c;
        else { char buf[4]; snprintf(buf, sizeof buf, "%%%02X", c); out += buf; }
    }
}
template <class T> static void tt_wr(std::string& out, const std::vector<T>& v) {
    out += " " + std::to_string(v.size());
    for (size_t i = 0; i < v.size(); i++) { T x = v[i]; tt_wr(out, x); }
}
${
	list
		? `static void tt_wr(std::string& out, ListNode* head) {
    std::vector<long long> values;
    std::set<ListNode*> seen;
    for (ListNode* n = head; n; n = n->next) {
        if (!seen.insert(n).second) { tt_error = "Your answer is a list that loops back on itself. Check the last next pointer."; return; }
        values.push_back(n->val);
    }
    tt_wr(out, values);
}`
		: ''
}
${
	tree
		? `static void tt_wr(std::string& out, TreeNode* root) {
    std::vector<TreeNode*> queue{root};
    std::set<TreeNode*> seen;
    std::vector<std::string> items;
    for (size_t q = 0; q < queue.size(); q++) {
        TreeNode* n = queue[q];
        if (!n) { items.push_back("_"); continue; }
        if (!seen.insert(n).second) { tt_error = "Your answer is not a tree: the same node appears twice."; return; }
        items.push_back(std::to_string(n->val));
        queue.push_back(n->left);
        queue.push_back(n->right);
    }
    while (!items.empty() && items.back() == "_") items.pop_back();
    out += " " + std::to_string(items.size());
    for (auto& s : items) out += " " + s;
}`
		: ''
}

static void tt_line(const std::string& text) { fputs(text.c_str(), stdout); fputc('\\n', stdout); fflush(stdout); }
}

int main() {
    using namespace trentorch_driver;
    FILE* tt_f = fopen(${JSON.stringify(CPP_INPUT_FILE)}, "rb");
    if (!tt_f) { fputs("The tests could not be read.\\n", stderr); return 1; }
    char tt_buf[65536]; size_t tt_got;
    while ((tt_got = fread(tt_buf, 1, sizeof tt_buf, tt_f)) > 0) tt_data.append(tt_buf, tt_got);
    fclose(tt_f);
    long long tt_calls; tt_rd(tt_calls);
    bool tt_slow = false;
    const std::string tt_code = ${JSON.stringify(code)};
    for (long long tt_c = 0; tt_c < tt_calls; tt_c++) {
        long long tt_id, tt_perf, tt_limit; tt_rd(tt_id); tt_rd(tt_perf); tt_rd(tt_limit);
${list ? '        tt_built.clear();' : ''}
${declare}
        if (tt_perf && tt_slow) { tt_line(tt_code + " " + std::to_string(tt_id) + " skip"); continue; }
        auto tt_started = std::chrono::steady_clock::now();
        auto tt_answer = ${name}(${args.join(', ')});
        double tt_ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - tt_started).count();
        if (tt_perf && tt_ms > (double)tt_limit) tt_slow = true;
        std::string tt_out;
        tt_error.clear();
        tt_wr(tt_out, tt_answer);
        if (!tt_error.empty()) { std::string tt_msg; tt_wr(tt_msg, tt_error); tt_line(tt_code + " " + std::to_string(tt_id) + " err" + tt_msg); continue; }
        char tt_took[40]; snprintf(tt_took, sizeof tt_took, "%.3f", tt_ms);
        tt_line(tt_code + " " + std::to_string(tt_id) + " ok " + tt_took + tt_out);
    }
    return 0;
}
`;
	// The student's own main() is not wanted (it would be a second one), but it stays valid code.
	// `#line 1` keeps the student's line numbers in compiler messages.
	return `#include <bits/stdc++.h>\n#define main trentorch_student_main\n#line 1\n${source}\n#undef main\n${driver}`;
}

function cppType(shape: NonNullable<ReturnType<typeof parseType>>): string {
	if (shape.kind === 'scalar') {
		return { int: 'long long', float: 'double', bool: 'bool', str: 'std::string' }[shape.scalar];
	}
	if (shape.kind === 'list') {
		let name = cppType({ kind: 'scalar', scalar: shape.scalar });
		for (let i = 0; i < shape.depth; i++) name = `std::vector<${name}>`;
		return name;
	}
	return shape.node === 'ListNode' ? 'ListNode*' : 'TreeNode*';
}
