// Minimal tar reader for the C++ sysroot: regular files only, which is all it holds. Directories are
// implied by the file paths. Handles the plain ustar layout and GNU long names (typeflag 'L').
export interface TarFile {
	path: string;
	data: Uint8Array;
}

const BLOCK = 512;
const decoder = new TextDecoder();

function field(header: Uint8Array, start: number, end: number): string {
	const text = decoder.decode(header.subarray(start, end));
	const nul = text.indexOf('\0');
	return nul === -1 ? text : text.slice(0, nul);
}

export function parseTar(bytes: Uint8Array): TarFile[] {
	const files: TarFile[] = [];
	let longName: string | null = null;
	for (let offset = 0; offset + BLOCK <= bytes.length;) {
		const header = bytes.subarray(offset, offset + BLOCK);
		// Two zero blocks end an archive.
		if (header.every((byte) => byte === 0)) break;
		const size = parseInt(field(header, 124, 136).trim() || '0', 8);
		const type = String.fromCharCode(header[156] || 48);
		const prefix = field(header, 345, 500);
		const name = field(header, 0, 100);
		const body = offset + BLOCK;
		if (type === 'L') {
			longName = field(bytes.subarray(body, body + size), 0, size);
		} else if (type === '0') {
			const path = (longName ?? (prefix ? `${prefix}/${name}` : name)).replace(/^\.?\//, '');
			files.push({ path, data: bytes.slice(body, body + size) });
			longName = null;
		}
		offset = body + Math.ceil(size / BLOCK) * BLOCK;
	}
	return files;
}
