// The DSA sheet's theory pages. Each step folder under data/app_data/13-dsa-sheet may hold a
// theory.md; it becomes the page /dsa/theory/<step>. A question links to one heading on that page
// through its `theory:` anchor (see processes/curriculum-build/build-question.mjs).
//
// Authoring format of a theory.md (plain Markdown plus two conventions):
//   - `# Chapter` and `## Section` headings. Every heading gets an anchor id, built by
//     `headingSlug` below, so "## 1.2 Selection sort" is reachable as #selection-sort.
//   - A ```python block directly followed by a ```cpp block is shown as one block with a
//     Python / C++ switch.
// Math is written $inline$ or $$display$$ (KaTeX), same as every other curriculum markdown.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import DOMPurify from 'isomorphic-dompurify';
import { Marked } from 'marked';
import { markdownMath } from '../markdown/markdown-math';

export const SHEET_DIR = join('data', 'app_data', '13-dsa-sheet');

export interface TheoryStep {
	step: string;
	title: string;
	file: string;
}

export interface TocEntry {
	id: string;
	title: string;
	sections: { id: string; title: string }[];
}

export interface TheoryPage {
	step: string;
	title: string;
	html: string;
	toc: TocEntry[];
}

const stripPrefix = (name: string) => name.replace(/^\d+-/, '');

/** "1.2 Selection sort" -> "selection-sort"; "Chapter 3. Designing it" -> "designing-it". */
export function headingSlug(title: string): string {
	return title
		.replace(/^chapter\s+\d+\.?\s*/i, '')
		.replace(/^\d+(\.\d+)*\.?\s+/, '')
		.toLowerCase()
		.replace(/[`*_$\\]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** The steps that have a theory.md, in sheet order. */
export function listTheorySteps(): TheoryStep[] {
	if (!existsSync(SHEET_DIR)) return [];
	return readdirSync(SHEET_DIR)
		.filter((name) => !name.startsWith('_') && !name.startsWith('.'))
		.filter((name) => statSync(join(SHEET_DIR, name)).isDirectory())
		.sort()
		.flatMap((name) => {
			const file = join(SHEET_DIR, name, 'theory.md');
			if (!existsSync(file)) return [];
			const meta = JSON.parse(readFileSync(join(SHEET_DIR, name, 'meta.json'), 'utf8')) as {
				title: string;
			};
			return [{ step: stripPrefix(name), title: meta.title, file }];
		});
}

// A python block followed by a cpp block (blank lines between are fine) becomes one tabbed block.
// The wrapper is a block-level <div>, and the blank lines around the fences let marked render the
// code inside it; the browser adds the Python / C++ switch (see CodeTabs in the page).
const PAIR = /```python\n([\s\S]*?)\n```[ \t]*\n+```cpp\n([\s\S]*?)\n```/g;

function groupCodeBlocks(markdown: string): string {
	return markdown.replace(
		PAIR,
		(_all, py: string, cpp: string) =>
			`<div class="code-tabs">\n\n\`\`\`python\n${py}\n\`\`\`\n\n\`\`\`cpp\n${cpp}\n\`\`\`\n\n</div>`
	);
}

export function renderTheory(step: TheoryStep): TheoryPage {
	const markdown = readFileSync(step.file, 'utf8');
	const toc: TocEntry[] = [];
	const used = new Map<string, number>();
	const unique = (slug: string) => {
		const n = (used.get(slug) ?? 0) + 1;
		used.set(slug, n);
		return n === 1 ? slug : `${slug}-${n}`;
	};

	const marked = new Marked();
	marked.use(markdownMath({ throwOnError: false }));
	marked.use({
		renderer: {
			heading({ tokens, depth }) {
				const html = this.parser.parseInline(tokens);
				const text = tokens.map((t) => ('text' in t ? String(t.text) : '')).join('');
				const id = unique(headingSlug(text));
				if (depth === 1)
					toc.push({ id, title: text.replace(/^chapter\s+\d+\.\s*/i, ''), sections: [] });
				else if (depth === 2 && toc.length > 0) {
					toc[toc.length - 1].sections.push({ id, title: text.replace(/^\d+(\.\d+)*\.?\s+/, '') });
				}
				return `<h${depth} id="${id}">${html}</h${depth}>\n`;
			}
		}
	});

	const dirty = marked.parse(groupCodeBlocks(markdown), { async: false }) as string;
	const html = DOMPurify.sanitize(dirty);
	return { step: step.step, title: step.title, html, toc };
}
