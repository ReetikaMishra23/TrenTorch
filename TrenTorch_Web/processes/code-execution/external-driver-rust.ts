import { ident } from '../ide-content/build-language-starters';
import type { ExternalFunction } from './external-protocol';

// The Rust program that runs a submission (see external-codec.ts for the text it reads and writes). The
// student's file is kept as it is, with its own main() renamed, and a module with the reader, the writer
// and the real main() is added. It reads every call from /sandbox/calls.txt and prints one line per answer.
//
// A panic aborts the program (the build uses panic=abort), so a call that panics ends the run; the answers
// printed before it are kept.

export const RUST_INPUT_FILE = '/sandbox/calls.txt';

const uses = (fn: ExternalFunction, node: string) =>
	[...fn.params.map((p) => p.type), fn.returns].includes(node);

const LIST_NODE = `
impl Rd for Option<Box<ListNode>> {
    fn rd(t: &mut Tok) -> Self {
        let values = Vec::<i64>::rd(t);
        // A list that loops back or joins another cannot be built from Box, so those calls are not sent.
        let _cycle = i64::rd(t);
        let _join_param = i64::rd(t);
        let _join_at = i64::rd(t);
        let mut head: Option<Box<ListNode>> = None;
        for v in values.iter().rev() {
            head = Some(Box::new(ListNode { val: *v, next: head }));
        }
        head
    }
}
impl Wr for Option<Box<ListNode>> {
    fn wr(&self, out: &mut String) -> Result<(), String> {
        let mut values: Vec<i64> = Vec::new();
        let mut at = self.as_deref();
        while let Some(n) = at {
            values.push(n.val);
            at = n.next.as_deref();
        }
        values.wr(out)
    }
}
`;

const TREE_NODE = `
impl Rd for Option<Box<TreeNode>> {
    fn rd(t: &mut Tok) -> Self {
        let n = i64::rd(t) as usize;
        let items: Vec<Option<i64>> = (0..n).map(|_| { let s = t.next(); if s == "_" { None } else { Some(parse_i64(s)) } }).collect();
        if items.is_empty() || items[0].is_none() { return None; }
        // Level order, as indexes first: node i has its children at the next free positions.
        let mut vals: Vec<i64> = vec![items[0].unwrap()];
        let mut left: Vec<i64> = vec![-1];
        let mut right: Vec<i64> = vec![-1];
        let mut next = 1usize;
        let mut q = 0usize;
        while q < vals.len() {
            for side in 0..2 {
                if next < items.len() {
                    if let Some(v) = items[next] {
                        vals.push(v); left.push(-1); right.push(-1);
                        let at = (vals.len() - 1) as i64;
                        if side == 0 { left[q] = at; } else { right[q] = at; }
                    }
                    next += 1;
                }
            }
            q += 1;
        }
        fn build(i: i64, vals: &Vec<i64>, left: &Vec<i64>, right: &Vec<i64>) -> Option<Box<TreeNode>> {
            if i < 0 { return None; }
            let u = i as usize;
            Some(Box::new(TreeNode { val: vals[u], left: build(left[u], vals, left, right), right: build(right[u], vals, left, right) }))
        }
        build(0, &vals, &left, &right)
    }
}
impl Wr for Option<Box<TreeNode>> {
    fn wr(&self, out: &mut String) -> Result<(), String> {
        let mut queue: Vec<Option<&TreeNode>> = vec![self.as_deref()];
        let mut items: Vec<String> = Vec::new();
        let mut q = 0usize;
        while q < queue.len() {
            match queue[q] {
                None => items.push("_".to_string()),
                Some(n) => {
                    items.push(n.val.to_string());
                    queue.push(n.left.as_deref());
                    queue.push(n.right.as_deref());
                }
            }
            q += 1;
        }
        while items.last().map_or(false, |s| s == "_") { items.pop(); }
        out.push_str(&format!(" {}", items.len()));
        for s in items { out.push(' '); out.push_str(&s); }
        Ok(())
    }
}
`;

export function buildRustDriver(source: string, fn: ExternalFunction, code: string): string {
	const name = ident('rust', fn.name);
	const driver = `
mod tt_driver {
    #![allow(unused)]
    use super::*;
    pub struct Tok<'a> { it: std::str::SplitAsciiWhitespace<'a> }
    impl<'a> Tok<'a> { pub fn next(&mut self) -> &'a str { self.it.next().unwrap_or("0") } }
    pub trait Rd: Sized { fn rd(t: &mut Tok) -> Self; }
    pub trait Wr { fn wr(&self, out: &mut String) -> Result<(), String>; }
    // Parsed by hand: the in-browser rustc cannot compile str::parse::<i64> (its backend lacks an opcode).
    pub fn parse_i64(s: &str) -> i64 {
        let b = s.as_bytes();
        let (neg, from) = if !b.is_empty() && b[0] == b'-' { (true, 1) } else { (false, 0) };
        let mut v: i64 = 0;
        let mut i = from;
        while i < b.len() {
            v = v.wrapping_mul(10).wrapping_sub((b[i] - b'0') as i64);
            i += 1;
        }
        if neg { v } else { v.wrapping_neg() }
    }
    fn hex(c: u8) -> u8 { if c >= b'A' { c - b'A' + 10 } else { c - b'0' } }
    impl Rd for i64 { fn rd(t: &mut Tok) -> Self { parse_i64(t.next()) } }
    impl Rd for f64 { fn rd(t: &mut Tok) -> Self { t.next().parse().unwrap() } }
    impl Rd for bool { fn rd(t: &mut Tok) -> Self { t.next() == "1" } }
    impl Rd for String {
        fn rd(t: &mut Tok) -> Self {
            let s = t.next().as_bytes();
            let mut r: Vec<u8> = Vec::new();
            let mut i = 1;
            while i < s.len() {
                if s[i] == b'%' {
                    r.push(hex(s[i + 1]) * 16 + hex(s[i + 2]));
                    i += 3;
                } else { r.push(s[i]); i += 1; }
            }
            String::from_utf8_lossy(&r).into_owned()
        }
    }
    impl<T: Rd> Rd for Vec<T> {
        fn rd(t: &mut Tok) -> Self {
            let n = i64::rd(t);
            (0..n).map(|_| T::rd(t)).collect()
        }
    }
    impl Wr for i64 { fn wr(&self, out: &mut String) -> Result<(), String> { out.push_str(&format!(" {}", self)); Ok(()) } }
    impl Wr for f64 { fn wr(&self, out: &mut String) -> Result<(), String> { out.push_str(&format!(" {}", self)); Ok(()) } }
    impl Wr for bool { fn wr(&self, out: &mut String) -> Result<(), String> { out.push_str(if *self { " 1" } else { " 0" }); Ok(()) } }
    impl Wr for String {
        fn wr(&self, out: &mut String) -> Result<(), String> {
            out.push_str(" s");
            for b in self.bytes() {
                if b.is_ascii_alphanumeric() { out.push(b as char); } else { out.push_str(&format!("%{:02X}", b)); }
            }
            Ok(())
        }
    }
    impl<T: Wr> Wr for Vec<T> {
        fn wr(&self, out: &mut String) -> Result<(), String> {
            out.push_str(&format!(" {}", self.len()));
            for x in self { x.wr(out)?; }
            Ok(())
        }
    }
${uses(fn, 'ListNode') ? LIST_NODE : ''}
${uses(fn, 'TreeNode') ? TREE_NODE : ''}
    pub fn run() {
        let data = std::fs::read_to_string(${JSON.stringify(RUST_INPUT_FILE)}).unwrap_or_default();
        let mut t = Tok { it: data.split_ascii_whitespace() };
        let code = ${JSON.stringify(code)};
        let calls = i64::rd(&mut t);
        let mut slow = false;
        for _ in 0..calls {
            let id = i64::rd(&mut t);
            let perf = i64::rd(&mut t) == 1;
            let limit = i64::rd(&mut t);
${fn.params.map((_, i) => `            let a${i} = Rd::rd(&mut t);`).join('\n')}
            if perf && slow { println!("{} {} skip", code, id); continue; }
            let started = std::time::Instant::now();
            let answer = ${name}(${fn.params.map((_, i) => `a${i}`).join(', ')});
            let ms = started.elapsed().as_secs_f64() * 1000.0;
            if perf && ms > limit as f64 { slow = true; }
            let mut out = String::new();
            let written = answer.wr(&mut out);
            // Not dropped: dropping a long Box list or a deep tree is recursive and overflows the small stack.
            std::mem::forget(answer);
            match written {
                Ok(()) => println!("{} {} ok {:.3}{}", code, id, ms, out),
                Err(message) => {
                    let mut m = String::new();
                    message.wr(&mut m).unwrap();
                    println!("{} {} err{}", code, id, m);
                }
            }
        }
    }
}
fn main() { tt_driver::run(); }
`;
	const renamed = source.replace(/\bfn\s+main\s*\(\s*\)/, 'fn tt_student_main()');
	return renamed + '\n' + driver;
}
