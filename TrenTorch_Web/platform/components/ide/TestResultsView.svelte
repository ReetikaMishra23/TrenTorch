<script lang="ts">
	import type { SubmissionResult } from '$data/curriculum/types';
	import { AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, XCircle } from '@lucide/svelte';

	let {
		results = null,
		ratingFeedback = null,
		nextHref = null
	} = $props<{
		results: SubmissionResult | null;
		ratingFeedback: {
			message: string;
			tone: 'success' | 'warning' | 'neutral';
		} | null;
		/** Where "Next question" goes, when there is a next question. */
		nextHref?: string | null;
	}>();

	// Which check's details are open. Defaults to the first failing one, else the first.
	let picked = $state<string | null>(null);
	$effect(() => {
		void results;
		picked = null;
	});
	const selected = $derived(
		results
			? (results.results.find((test: { name: string }) => test.name === picked) ??
					results.results.find((test: { passed: boolean }) => !test.passed) ??
					results.results[0])
			: undefined
	);

	function getErrorSummary(error: string): string {
		return error.trim().split('\n').at(-1)?.trim() || 'Python could not complete this run.';
	}

	function getErrorTitle(error: string): string {
		if (/SyntaxError|IndentationError/.test(error)) return 'Python syntax error';
		if (error.includes('Test harness does not contain')) return 'Test setup error';
		return 'Python execution error';
	}

	// "test_07_case_3" -> "case_3": the number prefix is just the run order.
	function shortName(name: string): string {
		return name.replace(/^test_\d+_/, '');
	}
</script>

<div class="flex h-full min-h-0 flex-col bg-background text-[13px] text-foreground">
	{#if results}
		<div class="flex h-9 shrink-0 items-center justify-between border-b border-border px-4 text-xs">
			<span class="font-medium text-muted-foreground">
				{results.isSample ? 'Sample run' : 'Full test suite'}
			</span>
			<span class="tabular-nums">
				<span class="font-semibold {results.allPassed ? 'text-(--ide-ok)' : 'text-(--ide-bad)'}">
					{results.passedTests}/{results.totalTests} passed
				</span>
				<span class="ml-1.5 text-muted-foreground">{results.totalDurationMs} ms</span>
			</span>
		</div>
	{/if}

	<div class="min-h-0 flex-1 overflow-y-auto p-4">
		{#if results}
			{#if results.allPassed}
				<div class="verdict verdict-ok mb-4">
					<CheckCircle2 class="size-6 shrink-0 text-(--ide-ok)" />
					<div class="min-w-0 flex-1">
						<h3 class="text-base font-semibold text-(--ide-ok)">
							{results.isSample ? 'Sample checks passed' : 'All tests passed'}
						</h3>
						<p class="text-xs text-muted-foreground">
							{#if results.isSample}
								This only ran the first {results.totalTests} check{results.totalTests === 1
									? ''
									: 's'}. Submit to run the full hidden suite and mark the question solved.
							{:else}
								Your code passes every check.
							{/if}
						</p>
					</div>
					{#if !results.isSample && nextHref}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- nextHref comes from resolve() in the page -->
						<a href={nextHref} class="next-link">
							Next question
							<ArrowRight class="size-3.5" />
						</a>
					{/if}
				</div>
			{:else if results.error && results.totalTests === 0}
				<div class="verdict verdict-bad mb-4 items-start">
					<XCircle class="mt-0.5 size-4 shrink-0 text-(--ide-bad)" />
					<div class="text-xs">
						<p class="font-semibold text-(--ide-bad)">{getErrorTitle(results.error)}</p>
						<p class="mt-1 break-words">{getErrorSummary(results.error)}</p>
						<p class="mt-1 text-muted-foreground">
							No tests ran. Fix this error before submitting.
						</p>
					</div>
				</div>
			{:else if results.totalTests === 0}
				<div class="verdict verdict-warn mb-4 items-start">
					<AlertCircle class="mt-0.5 size-4 shrink-0 text-(--ide-warn)" />
					<div class="text-xs">
						<p class="font-semibold text-(--ide-warn)">No tests ran</p>
						<p class="mt-1">The test runner did not find any checks for this question.</p>
					</div>
				</div>
			{:else}
				<div class="verdict verdict-bad mb-4">
					<XCircle class="size-6 shrink-0 text-(--ide-bad)" />
					<div>
						<h3 class="text-base font-semibold text-(--ide-bad)">
							{results.failedTests} of {results.totalTests} failed
						</h3>
						<p class="text-xs text-muted-foreground">
							{results.isSample ? 'Sample checks' : 'Test suite'}: pick a red check below to see
							why.
						</p>
					</div>
				</div>
			{/if}

			{#if ratingFeedback}
				<div
					role="status"
					class="mb-4 rounded-lg border p-3 text-xs {ratingFeedback.tone === 'success'
						? 'verdict-ok'
						: ratingFeedback.tone === 'warning'
							? 'verdict-warn'
							: 'border-border bg-secondary text-muted-foreground'}"
				>
					<p class="font-semibold">Today's POTD rating</p>
					<p class="mt-1">{ratingFeedback.message}</p>
				</div>
			{/if}

			{#if results.error && results.totalTests > 0}
				<div class="verdict verdict-bad mb-4 block">
					<div class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-(--ide-bad)">
						<XCircle class="size-3.5" />
						<span>{getErrorTitle(results.error)}</span>
					</div>
					<pre class="font-mono text-[11px] whitespace-pre-wrap">{results.error}</pre>
				</div>
			{/if}

			{#if results.results.length > 0}
				<div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Checks">
					{#each results.results as test (test.name)}
						<button
							type="button"
							role="tab"
							aria-selected={selected?.name === test.name}
							title={test.name}
							class="chip {test.passed ? 'chip-ok' : 'chip-bad'} {selected?.name === test.name
								? 'chip-selected'
								: ''}"
							onclick={() => (picked = test.name)}
						>
							<span class="chip-dot" aria-hidden="true"></span>
							{shortName(test.name)}
						</button>
					{/each}
				</div>

				{#if selected}
					<div class="mt-3 rounded-lg border border-border bg-secondary p-3.5">
						<div class="flex items-center justify-between gap-3">
							<div class="flex min-w-0 items-center gap-2">
								{#if selected.passed}
									<CheckCircle2 class="size-4 shrink-0 text-(--ide-ok)" />
								{:else}
									<XCircle class="size-4 shrink-0 text-(--ide-bad)" />
								{/if}
								<span class="truncate font-mono text-xs font-medium">{selected.name}</span>
							</div>
							<span
								class="font-mono text-[11px] whitespace-nowrap text-muted-foreground tabular-nums"
								>{selected.durationMs} ms</span
							>
						</div>
						{#if !selected.passed && selected.error}
							<pre
								class="mt-3 rounded-md border border-border bg-background p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-(--ide-bad)">{selected.error}</pre>
						{:else if selected.passed}
							<p class="mt-2 text-xs text-muted-foreground">Passed.</p>
						{/if}
					</div>
				{/if}
			{/if}
		{:else}
			<div
				class="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground"
			>
				<ShieldCheck class="mb-3 size-9 stroke-[1.5] opacity-70" />
				<p class="font-medium text-foreground">No results yet</p>
				<p class="mt-1 text-xs">
					Run your code to check it against the examples, or submit to run every test.
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.verdict {
		display: flex;
		align-items: center;
		gap: 12px;
		border: 1px solid transparent;
		border-radius: 10px;
		padding: 14px 16px;
	}
	.verdict-ok {
		border-color: color-mix(in oklab, var(--ide-ok) 30%, transparent);
		background: color-mix(in oklab, var(--ide-ok) 9%, transparent);
	}
	.verdict-bad {
		border-color: color-mix(in oklab, var(--ide-bad) 32%, transparent);
		background: color-mix(in oklab, var(--ide-bad) 8%, transparent);
	}
	.verdict-warn {
		border-color: color-mix(in oklab, var(--ide-warn) 35%, transparent);
		background: color-mix(in oklab, var(--ide-warn) 9%, transparent);
	}

	.next-link {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 6px;
		border-radius: 8px;
		background: var(--ide-accent);
		padding: 7px 12px;
		color: var(--ide-accent-fg);
		font-size: 12px;
		font-weight: 600;
		text-decoration: none;
		transition: filter 120ms;
	}
	.next-link:hover {
		filter: brightness(1.1);
	}

	.chip {
		font-family: var(--ide-mono);
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--secondary);
		padding: 4px 11px 4px 9px;
		color: var(--muted-foreground);
		font-family: var(--ide-mono);
		font-size: 11.5px;
		cursor: pointer;
		transition:
			background 120ms,
			border-color 120ms,
			color 120ms;
	}
	.chip:hover {
		color: var(--foreground);
		background: var(--muted);
	}
	.chip-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.chip-ok .chip-dot {
		background: var(--ide-ok);
	}
	.chip-bad {
		color: var(--foreground);
	}
	.chip-bad .chip-dot {
		background: var(--ide-bad);
	}
	.chip-selected {
		border-color: var(--ide-accent);
		background: var(--muted);
		color: var(--foreground);
	}
</style>
