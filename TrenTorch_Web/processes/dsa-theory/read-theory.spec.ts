import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headingSlug, listTheorySteps, renderTheory } from './read-theory';

describe('headingSlug', () => {
	it('drops chapter and section numbers', () => {
		expect(headingSlug('Chapter 3. Designing it')).toBe('designing-it');
		expect(headingSlug('1.2 Selection sort')).toBe('selection-sort');
	});

	it('keeps plain headings and strips markup', () => {
		expect(headingSlug('The `gcd` and $x$')).toBe('the-gcd-and-x');
	});
});

describe('renderTheory', () => {
	const steps = listTheorySteps();

	it('finds the sheet steps that have a theory.md', () => {
		expect(steps.length).toBeGreaterThan(0);
	});

	it.each(steps.map((step) => [step.step, step] as const))(
		'%s renders headings with ids and tabbed code',
		(_name, step) => {
			const page = renderTheory(step);
			expect(page.toc.length).toBeGreaterThan(0);
			expect(page.html).toContain('<div class="code-tabs">');
			for (const chapter of page.toc) expect(page.html).toContain(`id="${chapter.id}"`);
		},
		30_000
	);
});

describe('question theory anchors', () => {
	it.each(listTheorySteps().map((step) => [step.step, step] as const))(
		'%s: every question links to an existing heading',
		(_name, step) => {
			const html = renderTheory(step).html;
			const dir = step.file.replace(/theory\.md$/, '');
			const broken: string[] = [];
			for (const topic of readdirSync(dir, { withFileTypes: true })) {
				if (!topic.isDirectory()) continue;
				for (const question of readdirSync(join(dir, topic.name), { withFileTypes: true })) {
					if (!question.isDirectory()) continue;
					const readme = readFileSync(join(dir, topic.name, question.name, 'README.md'), 'utf8');
					const anchor = /^theory: (.+)$/m.exec(readme)?.[1];
					if (anchor && !html.includes(`id="${anchor}"`))
						broken.push(`${question.name}: ${anchor}`);
				}
			}
			expect(broken).toEqual([]);
		},
		30_000
	);
});

describe('question links', () => {
	it('turns "the problem *Title*" into a link to that sheet question', () => {
		const step = listTheorySteps().find((s) => s.step === 'dynamic-programming');
		if (!step) throw new Error('dynamic-programming theory missing');
		const html = renderTheory(step).html;
		expect(html).toContain('<a href="/ide/sheet-house-robber">House Robber</a>');
	}, 60_000);
});
