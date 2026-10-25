<script lang="ts">
	import { marked } from 'marked';
	import { markdownMath } from '$processes/markdown/markdown-math';
	import { tick } from 'svelte';
	import DOMPurify from 'isomorphic-dompurify';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import Button from '$components/Button.svelte';
	import DiscussionTab from '$components/discussion/DiscussionTab.svelte';
	import ReportBugDialog from './ReportBugDialog.svelte';
	import type { QuestionContent, QuestionMetadata } from '$data/curriculum/types';
	import type { CompanyTag } from '$data/questions';
	import CompaniesBadge from '$components/CompaniesBadge.svelte';
	import { extractSimpleVersion } from '$processes/ide-content/extract-simple-version';
	import { BookOpen, CheckCircle2, FileText, Lightbulb, MessageSquare } from '@lucide/svelte';
	import {
		embeddedWidgetIds as embeddedWidgetIdsIn,
		mathVisualizerIdSet,
		systemsVisualizerIdSet,
		classicalMLVisualizerIdSet,
		widgetRegistry
	} from '../../widgets/registry.js';
	import '../../widgets/widget-base.css';

	// Registered once, module-wide -- READMEs write formulas as $inline$ or
	// $$block$$ LaTeX, and this is what turns that into real, rendered math
	// instead of literal dollar-sign text.
	marked.use(markdownMath({ throwOnError: false }));

	// Curriculum markdown is first-party today, but nothing enforces that
	// invariant upstream -- sanitize the rendered HTML before it goes into
	// {@html} so a future less-trusted content source (or a compromised
	// `marked`/`marked-katex-extension` release) can't ship a script tag
	// straight to every visitor. DOMPurify's default allowlist covers KaTeX's
	// HTML+MathML output without extra config.
	function toSafeHtml(markdown: string): string {
		return DOMPurify.sanitize(marked.parse(markdown, { async: false }) as string);
	}

	let {
		content,
		isCompleted = false,
		visibleTabs = ['description', 'theory', 'solution'],
		companies = undefined
	} = $props<{
		content: QuestionContent;
		isCompleted?: boolean;
		/** Which guide tabs to offer for this question -- the ide/[id] page
		 * narrows this for Problem of the Day questions (today's: just
		 * Description; a past one: Description + Theory, still no Solution).
		 * Every other question gets the full default set. */
		visibleTabs?: ('description' | 'theory' | 'solution' | 'discussion')[];
		/** From data/questions.ts's Question.companies, looked up by slug in
		 * +page.ts -- most questions legitimately have none. */
		companies?: CompanyTag;
	}>();

	let relatedModuleHref = $derived.by(() => {
		const relatedModule = content.metadata.relatedModule;
		if (!relatedModule) return null;
		return (
			resolve('/questions/[partId]', { partId: relatedModule.partId }) +
			`?topic=${encodeURIComponent(relatedModule.topicTag)}`
		);
	});

	let activeTab = $state<'description' | 'theory' | 'solution' | 'discussion'>('description');
	let showSolution = $state(false);
	// DSA sheet hints are shown one at a time, so a student takes only as much help as needed.
	let hintsShown = $state(0);
	let reportBugOpen = $state(false);
	let scroller: HTMLElement | undefined = $state();
	let theoryContainer: HTMLElement | undefined = $state();
	let generatedVisualizerRoot: HTMLDivElement | undefined = $state();

	let descriptionParts = $derived.by(() => {
		const constraintsHeading = /^#{1,6}\s+constraints\b.*$/im.exec(content.descriptionMarkdown);
		return constraintsHeading
			? {
					before: content.descriptionMarkdown.slice(0, constraintsHeading.index),
					constraints: content.descriptionMarkdown.slice(constraintsHeading.index)
				}
			: { before: content.descriptionMarkdown, constraints: '' };
	});
	let descriptionBeforeConstraintsHtml = $derived(toSafeHtml(descriptionParts.before));
	let constraintsHtml = $derived(
		descriptionParts.constraints ? toSafeHtml(descriptionParts.constraints) : ''
	);
	let theoryHtml = $derived(toSafeHtml(content.theoryMarkdown));
	// A question that merges several topics embeds one placeholder per
	// visualizer, `<div data-widget="<id>">`, in its Theory markdown, so each
	// part keeps its own interactive demo. Questions that declare a single
	// `widget:` or that match a generated visualizer id use the paths below.
	let embeddedWidgetIds = $derived(
		content.widgetId ? [] : embeddedWidgetIdsIn(content.theoryMarkdown)
	);
	let activeVisualizerId = $derived(content.widgetId ?? embeddedWidgetIds[0] ?? content.id);
	let hasInteractiveVisualizer = $derived(
		Boolean(
			embeddedWidgetIds.length > 0 ||
			(content.widgetId && widgetRegistry[content.widgetId as keyof typeof widgetRegistry]) ||
			mathVisualizerIdSet.has(content.id) ||
			systemsVisualizerIdSet.has(content.id) ||
			classicalMLVisualizerIdSet.has(content.id)
		)
	);
	// Shown collapsed under the Description so the plain-language idea is in
	// the static page for search engines. Only when this question is allowed
	// to show Theory at all: a Problem of the Day keeps it hidden until its
	// date has passed, so it must not leak here either.
	let simpleVersionHtml = $derived.by(() => {
		if (!visibleTabs.includes('theory')) return '';
		const section = extractSimpleVersion(content.theoryMarkdown);
		return section ? toSafeHtml(section) : '';
	});
	let solutionHtml = $derived(
		toSafeHtml(
			'```' +
				(content.dbSchema !== undefined ? 'sql' : 'python') +
				'\n' +
				content.solutionCode +
				'\n```'
		)
	);
	let explanationHtml = $derived(
		content.explanationMarkdown ? toSafeHtml(content.explanationMarkdown) : ''
	);

	const tabs = [
		{ id: 'description', label: 'Description', icon: FileText },
		{ id: 'theory', label: 'Theory', icon: BookOpen },
		{ id: 'solution', label: 'Solution', icon: Lightbulb },
		{ id: 'discussion', label: 'Discussion', icon: MessageSquare }
	] as const;

	// Difficulty is shown as a small meter (bars filled) in the theme's own colours.
	const difficultyMeter: Record<QuestionMetadata['difficulty'], { level: number; color: string }> =
		{
			Beginner: { level: 1, color: 'var(--ide-ok)' },
			Intermediate: { level: 2, color: 'var(--ide-warn)' },
			Advanced: { level: 3, color: 'color-mix(in oklab, var(--ide-warn) 50%, var(--ide-bad))' },
			Mastery: { level: 4, color: 'var(--ide-bad)' }
		};
	const meter = $derived(
		difficultyMeter[content.metadata.difficulty as QuestionMetadata['difficulty']] ??
			difficultyMeter.Beginner
	);

	function selectTab(tab: 'description' | 'theory' | 'solution' | 'discussion') {
		activeTab = tab;
		// The solution only stays revealed while the Solution tab is actually
		// active -- stepping away to check Theory (or back to Description)
		// hides it again, so seeing it a second time always takes a
		// deliberate click, never leaks in as a side effect of tabbing around.
		if (tab !== 'solution') showSolution = false;
	}

	async function openInteractiveVisualizer() {
		selectTab('theory');
		await tick();
		const root =
			generatedVisualizerRoot ??
			theoryContainer?.querySelector<HTMLElement>(`[data-widget="${activeVisualizerId}"]`);
		if (!root) return;
		root.setAttribute('tabindex', '-1');
		root.focus({ preventScroll: true });
		root.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Every code block in the reading area gets a Copy button (shown on hover).
	$effect(() => {
		void [activeTab, descriptionBeforeConstraintsHtml, constraintsHtml, theoryHtml, solutionHtml];
		void [showSolution, explanationHtml];
		if (!browser) return;
		tick().then(() => {
			for (const pre of scroller?.querySelectorAll<HTMLPreElement>('.ide-prose pre') ?? []) {
				if (pre.querySelector(':scope > .copy-code')) continue;
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'copy-code';
				button.textContent = 'Copy';
				button.setAttribute('aria-label', 'Copy code');
				button.addEventListener('click', async () => {
					try {
						await navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? '');
						button.textContent = 'Copied';
						setTimeout(() => (button.textContent = 'Copy'), 1500);
					} catch {
						button.textContent = 'Press Ctrl+C';
					}
				});
				pre.appendChild(button);
			}
		});
	});

	// Reset per-question UI state whenever the question itself changes --
	// otherwise an open tab or revealed solution would leak from one
	// question into the next.
	$effect(() => {
		void content.id;
		activeTab = 'description';
		showSolution = false;
		hintsShown = 0;
	});

	// Mount the question's interactive widget (see platform/widgets/) once
	// its markup is actually in the DOM -- {@html} only sets innerHTML, so
	// any <script> embedded in the Theory markdown itself would never run;
	// the widget's real behavior lives in a dynamically-imported module
	// instead. Re-runs (tearing the previous mount down first) whenever the
	// tab, the question, or theoryHtml itself changes.
	$effect(() => {
		const tab = activeTab;
		const widgetId =
			content.widgetId ??
			(mathVisualizerIdSet.has(content.id) ||
			systemsVisualizerIdSet.has(content.id) ||
			classicalMLVisualizerIdSet.has(content.id)
				? content.id
				: undefined);
		void content.id;
		void theoryHtml;

		if (!browser || tab !== 'theory' || !widgetId) return;

		let cancelled = false;
		let cleanup: (() => void) | undefined;

		(async () => {
			await tick();
			if (cancelled) return;
			const loader = widgetRegistry[widgetId as keyof typeof widgetRegistry];
			if (!loader) return;
			const mod = await loader();
			if (cancelled) return;
			const generatedRoot =
				!content.widgetId &&
				(mathVisualizerIdSet.has(widgetId) ||
					systemsVisualizerIdSet.has(widgetId) ||
					classicalMLVisualizerIdSet.has(widgetId));
			const root = generatedRoot
				? generatedVisualizerRoot
				: theoryContainer?.querySelector(`[data-widget="${widgetId}"]`);
			if (root instanceof HTMLElement) {
				cleanup = mod.mount(root);
			}
		})();

		return () => {
			cancelled = true;
			cleanup?.();
		};
	});

	// Mount every visualizer embedded in the Theory markdown (see
	// embeddedWidgetIds), each into its own placeholder.
	$effect(() => {
		const ids = embeddedWidgetIds;
		void theoryHtml;

		if (!browser || activeTab !== 'theory' || ids.length === 0) return;

		let cancelled = false;
		const cleanups: Array<() => void> = [];

		(async () => {
			await tick();
			for (const id of ids) {
				if (cancelled) return;
				const loader = widgetRegistry[id as keyof typeof widgetRegistry];
				const mod = await loader();
				if (cancelled) return;
				const root = theoryContainer?.querySelector(`[data-widget="${id}"]`);
				if (root instanceof HTMLElement) cleanups.push(mod.mount(root));
			}
		})();

		return () => {
			cancelled = true;
			cleanups.forEach((cleanup) => cleanup());
		};
	});
</script>

<div class="flex h-full bg-background text-foreground">
	<!-- A slim rail for the guide's sections, with the previous / next question
	     arrows at its foot -->
	<div
		class="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-secondary py-2"
		role="tablist"
		aria-orientation="vertical"
		aria-label="Question sections"
	>
		{#each tabs as tab (tab.id)}
			{#if visibleTabs.includes(tab.id)}
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-label={tab.label}
					title={tab.label}
					class="rail-tab relative flex size-9 items-center justify-center rounded-lg transition-colors {activeTab ===
					tab.id
						? 'rail-active bg-muted text-foreground'
						: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
					onclick={() => selectTab(tab.id)}
				>
					<tab.icon class="size-[18px]" />
				</button>
			{/if}
		{/each}
	</div>

	<div bind:this={scroller} class="min-w-0 flex-1 overflow-y-auto px-7 py-6 text-[15px]">
		<!-- Header info: shown on every section so difficulty/tags/solved status
		     stay visible no matter which one a student is reading. -->
		<div class="mb-6">
			<div class="mb-3.5 flex items-start justify-between gap-3">
				<h1 class="text-[1.65rem] leading-tight font-semibold tracking-[-0.02em] text-foreground">
					{content.metadata.title}
				</h1>
				{#if isCompleted}
					<span
						class="mt-1.5 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-(--ide-ok)"
					>
						<CheckCircle2 class="size-4" />
						Solved
					</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
				<span
					class="inline-flex items-center gap-1.5 text-xs font-semibold"
					style:color={meter.color}
				>
					<span class="size-1.5 rounded-full" style:background={meter.color} aria-hidden="true"
					></span>
					{content.metadata.difficulty}
				</span>
				{#if companies}
					<CompaniesBadge {companies} />
				{/if}
			</div>
		</div>

		{#if activeTab === 'description'}
			{#if content.metadata.kind === 'problemset'}
				<div class="mb-4 flex flex-wrap items-start gap-3 border-b border-border pb-4">
					{#if relatedModuleHref && content.metadata.relatedModule}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- already passed through resolve() in relatedModuleHref -->
						<a
							href={relatedModuleHref}
							class="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2.5 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary"
						>
							Learn: {content.metadata.relatedModule.topicTag}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
					{#if content.metadata.hint}
						<details class="min-w-48 flex-1 rounded border border-border px-3 py-2 text-xs">
							<summary class="cursor-pointer font-mono font-medium text-muted-foreground">
								Show hint
							</summary>
							<p class="mt-2 leading-relaxed text-foreground">{content.metadata.hint}</p>
						</details>
					{/if}
				</div>
			{/if}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="question-prose ide-prose">{@html descriptionBeforeConstraintsHtml}</div>
			{#if hasInteractiveVisualizer}
				<button
					type="button"
					class="interactive-visualizer-cta"
					onclick={openInteractiveVisualizer}
				>
					<span class="interactive-visualizer-cta-kicker">Try it live</span>
					<span class="interactive-visualizer-cta-copy"> Explore the idea interactively </span>
					<span class="interactive-visualizer-cta-action">Open in Theory →</span>
				</button>
			{/if}
			{#if constraintsHtml}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="question-prose ide-prose">{@html constraintsHtml}</div>
			{/if}
			{#if content.metadata.hints?.length}
				<div class="mt-8 space-y-2 border-t border-border pt-5">
					{#each content.metadata.hints.slice(0, hintsShown) as hint, index (index)}
						<div
							class="rounded-lg border border-border bg-secondary px-4 py-3 text-sm leading-relaxed"
						>
							<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
								Hint {index + 1} of {content.metadata.hints.length}
							</span>
							<p class="question-prose ide-prose mt-1">{hint}</p>
						</div>
					{/each}
					{#if hintsShown < content.metadata.hints.length}
						<button
							type="button"
							class="rounded-lg bg-muted px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/15"
							onclick={() => (hintsShown += 1)}
						>
							Show hint {hintsShown + 1}
						</button>
					{/if}
				</div>
			{/if}
			{#if content.metadata.tags.length}
				<div class="mt-8 border-t border-border pt-5">
					<h2 class="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Keywords
					</h2>
					<div class="flex flex-wrap gap-2">
						{#each content.metadata.tags as tag (tag)}
							<span
								class="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground"
								>{tag}</span
							>
						{/each}
					</div>
				</div>
			{/if}
			{#if simpleVersionHtml}
				<details class="mt-8 border-t border-border pt-5">
					<summary
						class="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground uppercase"
					>
						The simple version
					</summary>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="question-prose ide-prose mt-3">{@html simpleVersionHtml}</div>
				</details>
			{/if}
			<div class="mt-8 border-t border-border pt-5">
				<Button variant="outline" size="sm" onclick={() => (reportBugOpen = true)}>
					Report a bug
				</Button>
			</div>
			<ReportBugDialog
				bind:open={reportBugOpen}
				questionId={content.id}
				questionTitle={content.metadata.title}
			/>
		{:else if activeTab === 'theory'}
			<div class="question-prose ide-prose" bind:this={theoryContainer}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html theoryHtml}
				{#if !content.widgetId && (mathVisualizerIdSet.has(content.id) || systemsVisualizerIdSet.has(content.id) || classicalMLVisualizerIdSet.has(content.id))}
					<div bind:this={generatedVisualizerRoot} data-widget={content.id}></div>
				{/if}
			</div>
		{:else if activeTab === 'solution' && !showSolution}
			<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
				<p class="max-w-xs text-xs text-muted-foreground">
					Try to solve it yourself first. The solution is here if you get stuck.
				</p>
				<button
					type="button"
					class="rounded-lg bg-muted px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/15"
					onclick={() => (showSolution = true)}
				>
					Reveal solution
				</button>
			</div>
		{:else if activeTab === 'solution'}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="question-prose ide-prose">{@html solutionHtml}</div>
			{#if explanationHtml}
				<div class="mt-6 border-t border-border pt-5">
					<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
						Why it's written this way
					</h2>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="question-prose ide-prose">{@html explanationHtml}</div>
				</div>
			{/if}
		{:else}
			<DiscussionTab questionId={content.id} />
		{/if}
	</div>
</div>

<style>
	/* The reading style for a question: Inter at 15px on a 1.75 line, headings
	   that read as headings, and the "Input: / Output:" labels and code blocks
	   of an example set off as one tidy card (the label is the paragraph
	   right before a code block). Scoped to the IDE; the privacy and terms
	   pages share .question-prose and keep their own look. */
	:global(.ide-prose) {
		font-size: 0.9375rem;
		line-height: 1.75;
		font-family: var(--ide-sans);
	}
	:global(.ide-prose :where(h1, h2, h3, h4)) {
		font-family: var(--ide-sans);
		letter-spacing: -0.01em;
		color: var(--foreground);
	}
	:global(.ide-prose :where(h2)) {
		margin: 2rem 0 0.75rem;
		font-size: 1.0625rem;
		font-weight: 650;
		line-height: 1.4;
	}
	:global(.ide-prose :where(h3)) {
		margin: 1.4rem 0 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.5;
	}
	:global(.ide-prose :where(p)) {
		margin: 0.75rem 0;
		color: color-mix(in oklab, var(--foreground) 88%, transparent);
	}
	:global(.ide-prose :where(strong)) {
		color: var(--foreground);
		font-weight: 600;
	}
	:global(.ide-prose :where(p:has(+ pre))) {
		margin: 0.85rem 0 0.35rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted-foreground);
	}
	.rail-active::before {
		content: '';
		position: absolute;
		left: -9px;
		top: 9px;
		bottom: 9px;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--ide-accent);
	}
	:global(.ide-prose :where(pre)) {
		position: relative;
		margin: 0 0 0.25rem;
		padding: 0.7rem 1rem;
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		background: var(--ide-code, var(--muted));
		font-family: var(--ide-mono);
		font-size: 0.8125rem;
		font-weight: 400;
		letter-spacing: -0.005em;
		line-height: 1.7;
	}
	:global(.ide-prose :where(:not(pre) > code)) {
		border: 0;
		border-radius: 0.375rem;
		background: var(--muted);
		padding: 0.15em 0.4em;
		font-family: var(--ide-mono);
		font-size: 0.85em;
		font-weight: 450;
	}
	:global(.ide-prose :where(li)) {
		margin-block: 0.4em;
		color: color-mix(in oklab, var(--foreground) 88%, transparent);
	}
	:global(.ide-prose :where(li)::marker) {
		color: var(--muted-foreground);
	}
	:global(.ide-prose :where(details)) {
		border-color: var(--border);
		border-radius: 0.625rem;
		background: var(--secondary);
	}
	:global(.ide-prose pre code) {
		font-family: inherit;
		font-size: inherit;
		font-weight: inherit;
	}
	:global(.ide-prose pre .copy-code) {
		position: absolute;
		top: 6px;
		right: 6px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--secondary);
		padding: 1px 8px;
		font-family: var(--ide-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		opacity: 0;
		transition: opacity 120ms;
		cursor: pointer;
	}
	:global(.ide-prose pre:hover .copy-code),
	:global(.ide-prose pre .copy-code:focus-visible) {
		opacity: 1;
	}
	:global(.ide-prose pre .copy-code:hover) {
		color: var(--foreground);
	}
	:global(.ide-prose :where(summary)) {
		font-family: var(--ide-sans);
	}
</style>
