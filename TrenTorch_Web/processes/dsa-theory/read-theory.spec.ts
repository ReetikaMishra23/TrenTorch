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
