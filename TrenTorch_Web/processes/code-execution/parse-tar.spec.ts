import { describe, expect, it } from 'vitest';
import { parseTar } from './parse-tar';

// One 512-byte header plus the body padded to a whole block.
function entry(name: string, body: string, type = '0', prefix = ''): Uint8Array {
	const bytes = new TextEncoder().encode(body);
	const header = new Uint8Array(512);
	const put = (text: string, at: number) => header.set(new TextEncoder().encode(text), at);
	put(name, 0);
	put(prefix, 345);
	put(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
	header[156] = type.charCodeAt(0);
	const padded = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
	padded.set(bytes);
	return Uint8Array.from([...header, ...padded]);
}

const end = new Uint8Array(1024);
const archive = (...parts: Uint8Array[]) =>
	Uint8Array.from([...parts.flatMap((p) => [...p]), ...end]);
const text = (data: Uint8Array) => new TextDecoder().decode(data);

describe('parseTar', () => {
	it('reads regular files and skips directories', () => {
		const files = parseTar(
			archive(entry('include/', '', '5'), entry('include/a.h', 'int a;'), entry('lib/b.a', 'B'))
		);
		expect(files.map((f) => f.path)).toEqual(['include/a.h', 'lib/b.a']);
		expect(text(files[0].data)).toBe('int a;');
	});

	it('joins the ustar prefix and name', () => {
		const [file] = parseTar(archive(entry('vector', 'v', '0', 'include/c++/v1')));
		expect(file.path).toBe('include/c++/v1/vector');
	});

	it('uses a GNU long name for the next file', () => {
		const long = 'a/'.repeat(60) + 'file.h';
		const [file] = parseTar(archive(entry('././@LongLink', `${long}\0`, 'L'), entry('short', 'x')));
		expect(file.path).toBe(long);
		expect(text(file.data)).toBe('x');
	});

	it('keeps an empty file and stops at the end marker', () => {
		const files = parseTar(archive(entry('empty', '')));
		expect(files).toHaveLength(1);
		expect(files[0].data).toHaveLength(0);
	});
});
