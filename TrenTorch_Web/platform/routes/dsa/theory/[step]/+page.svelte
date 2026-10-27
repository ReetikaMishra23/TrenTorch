<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ArrowLeft, ArrowUp } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const theory = $derived(data.theory);

	let content: HTMLElement | undefined = $state();
	let nav: HTMLElement | undefined = $state();
	let activeId = $state('');
	let showTop = $state(false);

	// The chapter whose sections are open in the side menu: the one holding the heading on screen.
	const activeChapter = $derived(
		theory.toc.find((c) => c.id === activeId || c.sections.some((s) => s.id === activeId))?.id ?? ''
	);

	// Marks the last heading that has scrolled past the top of the window.
	function watchHeadings(root: HTMLElement) {
		const headings = [...root.querySelectorAll<HTMLElement>('h1[id], h2[id]')];
		const update = () => {
			let current = headings[0]?.id ?? '';
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top <= 120) current = heading.id;
				else break;
			}
			activeId = current;
			showTop = window.scrollY > 600;
		};
		window.addEventListener('scroll', update, { passive: true });
		update();
		return () => window.removeEventListener('scroll', update);
	}

	// Keeps the highlighted menu entry in view inside the (separately scrolling) side menu.
	$effect(() => {
		if (!nav || !activeId) return;
		const link = nav.querySelector<HTMLElement>(`a[data-id="${CSS.escape(activeId)}"]`);
		if (link) nav.scrollTo({ top: link.offsetTop - nav.clientHeight / 2, behavior: 'smooth' });
	});

	const LANGUAGES = [
		{ id: 'python', label: 'Python' },
		{ id: 'cpp', label: 'C++' }
	];
	const STORAGE_KEY = 'trentorch-theory-language';

	// A Python block followed by a C++ block arrives as <div class="code-tabs"> with both
	// <pre> blocks inside. Add a switch above each one; the choice is shared by every block
	// on the page and remembered for the next visit.
	function enhance(root: HTMLElement) {
		let language = 'python';
		try {
			language = localStorage.getItem(STORAGE_KEY) === 'cpp' ? 'cpp' : 'python';
		} catch {
			// private window or blocked storage: the default is fine
		}
		const groups = [...root.querySelectorAll<HTMLElement>('.code-tabs')];
		const apply = () => {
			for (const group of groups) {
				for (const pre of group.querySelectorAll<HTMLElement>('pre')) {
					const lang = pre.querySelector('code')?.className.includes('language-cpp')
						? 'cpp'
						: 'python';
					pre.hidden = lang !== language;
				}
				for (const button of group.querySelectorAll<HTMLButtonElement>('.code-tab-bar button')) {
					const active = button.dataset.lang === language;
					button.setAttribute('aria-selected', String(active));
					button.classList.toggle('active', active);
				}
			}
		};
		for (const group of groups) {
			const bar = document.createElement('div');
			bar.className = 'code-tab-bar';
			bar.setAttribute('role', 'tablist');
			for (const { id, label } of LANGUAGES) {
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = label;
				button.dataset.lang = id;
				button.setAttribute('role', 'tab');
				button.addEventListener('click', () => {
					language = id;
					try {
						localStorage.setItem(STORAGE_KEY, id);
					} catch {
						// not persisted, still switches
					}
					apply();
				});
				bar.append(button);
			}
			group.prepend(bar);
		}
		apply();
	}

	onMount(() => {
		const root = document.documentElement;
		const previousBehavior = root.style.scrollBehavior;
		root.style.scrollBehavior = 'smooth';
		const stopWatching = content ? watchHeadings(content) : undefined;
		if (content) enhance(content);
		// A link such as /dsa/theory/sorting#selection-sort: the page is prerendered, so the
		// browser has already placed the heading; scroll again once the code blocks changed height.
		if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
		return () => {
			stopWatching?.();
			root.style.scrollBehavior = previousBehavior;
		};
	});
</script>

<svelte:head>
	<title>Theory: {theory.title} | DSA Sheet</title>
</svelte:head>

<div class="mx-auto w-full max-w-[96rem] px-4 py-6 lg:px-8">
	<a
		href={resolve('/dsa')}
		class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> DSA Sheet
	</a>
	<h1 class="mb-6 text-3xl font-semibold tracking-tight">Theory: {theory.title}</h1>

	<div class="grid gap-8 lg:grid-cols-[14.5rem_minmax(0,1fr)]">
		<nav
			aria-label="On this page"
			class="theory-toc lg:sticky lg:top-4 lg:self-start"
			bind:this={nav}
		>
			{#each theory.toc as chapter (chapter.id)}
				<a
					class="chapter"
					class:active={activeId === chapter.id}
					data-id={chapter.id}
					href="#{chapter.id}">{chapter.title}</a
				>
				{#if activeChapter === chapter.id}
					{#each chapter.sections as section (section.id)}
						<a
							class="section"
							class:active={activeId === section.id}
							data-id={section.id}
							href="#{section.id}">{section.title}</a
						>
					{/each}
				{/if}
			{/each}
		</nav>
		<article class="question-prose theory-body" bind:this={content}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised with DOMPurify at build time -->
			{@html theory.html}
		</article>
	</div>
</div>

{#if showTop}
	<button
		type="button"
		class="fixed right-6 bottom-6 z-40 flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md hover:bg-secondary"
		aria-label="Go to top"
		onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
	>
		<ArrowUp class="size-5" />
	</button>
{/if}

<style>
	.theory-toc {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.85rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		position: relative;
		scrollbar-width: thin;
	}
	.theory-toc .chapter {
		margin-top: 0.75rem;
		font-weight: 600;
		color: var(--foreground);
	}
	.theory-toc .section {
		padding-left: 0.75rem;
		color: var(--muted-foreground);
	}
	.theory-toc a:hover,
	.theory-toc a.active {
		color: var(--foreground);
	}
	.theory-toc a.active {
		font-weight: 600;
	}
	.theory-body {
		max-width: 64rem;

		/* Code colours, from the same token classes the editor uses. */
		--tok-keyword: #a626a4;
		--tok-string: #3b7d1d;
		--tok-number: #b45f06;
		--tok-comment: #7a7f87;
		--tok-type: #0b7285;
		--tok-name: #c2410c;
		--tok-operator: #4b5563;
	}
	:global(.dark) .theory-body {
		--tok-keyword: #d6a0f0;
		--tok-string: #98c379;
		--tok-number: #e5a56a;
		--tok-comment: #8b929c;
		--tok-type: #56c2d6;
		--tok-name: #e68a6e;
		--tok-operator: #aab2bf;
	}
	.theory-body :global(.tok-keyword),
	.theory-body :global(.tok-controlKeyword),
	.theory-body :global(.tok-definitionKeyword),
	.theory-body :global(.tok-moduleKeyword),
	.theory-body :global(.tok-operatorKeyword) {
		color: var(--tok-keyword);
	}
	.theory-body :global(.tok-string),
	.theory-body :global(.tok-string2) {
		color: var(--tok-string);
	}
	.theory-body :global(.tok-number),
	.theory-body :global(.tok-bool),
	.theory-body :global(.tok-atom) {
		color: var(--tok-number);
	}
	.theory-body :global(.tok-comment),
	.theory-body :global(.tok-lineComment),
	.theory-body :global(.tok-blockComment) {
		color: var(--tok-comment);
		font-style: italic;
	}
	.theory-body :global(.tok-typeName),
	.theory-body :global(.tok-type),
	.theory-body :global(.tok-className),
	.theory-body :global(.tok-namespace) {
		color: var(--tok-type);
	}
	.theory-body :global(.tok-definition),
	.theory-body :global(.tok-variableName.tok-function),
	.theory-body :global(.tok-propertyName),
	.theory-body :global(.tok-macroName) {
		color: var(--tok-name);
	}
	.theory-body :global(.tok-operator),
	.theory-body :global(.tok-punctuation) {
		color: var(--tok-operator);
	}
	.theory-body :global(h1),
	.theory-body :global(h2),
	.theory-body :global(h3) {
		scroll-margin-top: 1.5rem;
	}
	.theory-body :global(.code-tab-bar) {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
	}
	.theory-body :global(.code-tab-bar button) {
		padding: 0.15rem 0.7rem;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		color: var(--muted-foreground);
		border: 1px solid var(--border);
	}
	.theory-body :global(.code-tab-bar button.active) {
		background: var(--secondary);
		color: var(--foreground);
	}
</style>
