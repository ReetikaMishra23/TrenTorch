import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listContentDirs } from './list-content-dirs.mjs';
import { stripNumericPrefix } from './strip-numeric-prefix.mjs';
import { buildTrack } from './build-track.mjs';
import { readMeta } from './read-meta.mjs';

export function buildSection(rootId, sectionDirName, sectionDirPath) {
	const sectionId = stripNumericPrefix(sectionDirName);
	const meta = readMeta(sectionDirPath, 'section');
	// Track dirs are listed (and thus sorted) here, using their raw
	// numeric-prefixed names, before buildTrack strips the prefix from
	// each one's own exposed id -- sort order comes from the folder
	// name, the id itself stays clean.
	// A section may carry a theory.md: the theory page its questions link to (see dsa-theory).
	const hasTheory = existsSync(join(sectionDirPath, 'theory.md'));
	const tracks = listContentDirs(sectionDirPath)
		.map((name) => buildTrack({ rootId, sectionId, hasTheory }, name, join(sectionDirPath, name)))
		// A track folder with no questions yet is a placeholder, not content.
		.filter((track) => track.questions.length > 0);
	return { id: sectionId, meta, hasTheory, tracks };
}
