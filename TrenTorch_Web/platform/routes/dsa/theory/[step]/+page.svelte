<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const theory = $derived(data.theory);

	let content: HTMLElement | undefined = $state();

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
		if (content) enhance(content);
		// A link such as /dsa/theory/sorting#selection-sort: the page is prerendered, so the
		// browser has already placed the heading; scroll again once the code blocks changed height.
		if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
	});
</script>

<svelte:head>
	<title>Theory: {theory.title} | DSA Sheet</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl px-4 py-8">
	<a
		href={resolve('/dsa')}
		class="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> DSA Sheet
	</a>
	<h1 class="mb-8 text-3xl font-semibold tracking-tight">Theory: {theory.title}</h1>

	<div class="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
		<nav aria-label="On this page" class="theory-toc lg:sticky lg:top-6 lg:self-start">
			{#each theory.toc as chapter (chapter.id)}
				<a class="chapter" href="#{chapter.id}">{chapter.title}</a>
				{#each chapter.sections as section (section.id)}
					<a class="section" href="#{section.id}">{section.title}</a>
				{/each}
			{/each}
		</nav>
		<article class="question-prose theory-body" bind:this={content}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised with DOMPurify at build time -->
			{@html theory.html}
		</article>
	</div>
</div>

<style>
	.theory-toc {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.85rem;
		max-height: calc(100vh - 3rem);
		overflow-y: auto;
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
	.theory-toc a:hover {
		color: var(--foreground);
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
