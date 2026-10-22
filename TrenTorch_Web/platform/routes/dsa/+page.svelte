<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		ArrowRight,
		Check,
		CheckCircle2,
		ChevronDown,
		Gauge,
		RotateCcw,
		Search
	} from '@lucide/svelte';
	import { dsaQuestions, dsaSteps } from '$data/dsa-sheet';
	import {
		countSolved,
		filterSheet,
		getSheetStatus,
		nextUnsolved,
		type SheetFilters,
		type SheetStatus
	} from '$processes/dsa-sheet/filter-sheet';
	import { attempted } from '$processes/progress-tracking/attempted.svelte';
	import { solved } from '$processes/progress-tracking/solved.svelte';

	const difficulties = ['Beginner', 'Intermediate', 'Advanced'];
	const statuses: { value: SheetStatus; label: string }[] = [
		{ value: 'all', label: 'All statuses' },
		{ value: 'solved', label: 'Solved' },
		{ value: 'attempted', label: 'Attempted' },
		{ value: 'unsolved', label: 'Unsolved' }
	];

	let searchQuery = $state('');
	let selectedDifficulty = $state('');
	let selectedStatus = $state<SheetStatus>('all');
	// Steps the visitor closed. Everything starts open.
	const closedSteps = new SvelteSet<string>();

	const filters = $derived<SheetFilters>({
		query: searchQuery,
		difficulty: selectedDifficulty,
		status: selectedStatus
	});
	const visibleSteps = $derived(filterSheet(dsaSteps, filters, solved.slugs, attempted.slugs));
	const visibleCount = $derived(
		visibleSteps.reduce(
			(sum, step) => sum + step.topics.reduce((n, topic) => n + topic.questions.length, 0),
			0
		)
	);
	const filtering = $derived(
		Boolean(searchQuery.trim() || selectedDifficulty || selectedStatus !== 'all')
	);
	const overall = $derived(countSolved(dsaQuestions, solved.slugs));
	const next = $derived(nextUnsolved(dsaQuestions, solved.slugs));

	function stepProgress(stepId: string) {
		const step = dsaSteps.find((s) => s.id === stepId);
		const questions = step?.topics.flatMap((topic) => topic.questions) ?? [];
		return countSolved(questions, solved.slugs);
	}

	function toggleStep(stepId: string) {
		if (closedSteps.has(stepId)) closedSteps.delete(stepId);
		else closedSteps.add(stepId);
	}

	function resetFilters() {
		searchQuery = '';
		selectedDifficulty = '';
		selectedStatus = 'all';
	}
</script>

<svelte:head>
	<title>DSA Sheet - TrenTorch</title>
	<meta
		name="description"
		content="A free, open-source DSA course. Write and run Python in your browser, step by step, with hints and tests."
	/>
</svelte:head>

<main class="sheet min-h-screen px-4 pt-7 pb-12 sm:px-5 md:px-6">
	<div class="mx-auto w-full max-w-[1180px]">
		<h1 class="mb-1 font-mono text-[1.4rem] font-bold">DSA Sheet</h1>
		<p class="mb-6 max-w-[680px] text-sm text-muted-foreground">
			Learn data structures and algorithms by writing code. Everything runs in your browser, so
			there is nothing to install. Solutions open after you solve a question.
		</p>

		<div class="progress-card mb-7">
			<div class="min-w-0 flex-1">
				<p class="mb-1 font-mono text-xs tracking-wider text-muted-foreground uppercase">
					Your progress
				</p>
				<p class="font-mono text-lg font-semibold">
					{overall.solved} <span class="text-muted-foreground">of {overall.total} solved</span>
				</p>
				<div
					class="bar mt-2"
					role="progressbar"
					aria-label="Questions solved"
					aria-valuemin={0}
					aria-valuemax={overall.total}
					aria-valuenow={overall.solved}
				>
					<span style="width: {overall.total ? (overall.solved / overall.total) * 100 : 0}%"></span>
				</div>
			</div>
			{#if next}
				<a href={resolve('/ide/[id]', { id: next.id })} class="continue-button">
					{overall.solved === 0 ? 'Start' : 'Continue'}: {next.title}
					<ArrowRight class="size-4 shrink-0" aria-hidden="true" />
				</a>
			{:else}
				<p class="font-mono text-sm text-[#3fb950]">All done. Nice work.</p>
			{/if}
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-2">
			<label class="search-field">
				<span class="sr-only">Search questions</span>
				<Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
				<input bind:value={searchQuery} type="search" placeholder="Search questions or tags..." />
			</label>

			<label class="filter-select">
				<CheckCircle2 class="filter-icon" aria-hidden="true" />
				<span class="sr-only">Filter by status</span>
				<select bind:value={selectedStatus}>
					{#each statuses as status (status.value)}
						<option value={status.value}>{status.label}</option>
					{/each}
				</select>
			</label>

			<label class="filter-select">
				<Gauge class="filter-icon" aria-hidden="true" />
				<span class="sr-only">Filter by difficulty</span>
				<select bind:value={selectedDifficulty}>
					<option value="">All difficulties</option>
					{#each difficulties as difficulty (difficulty)}
						<option value={difficulty}>{difficulty}</option>
					{/each}
				</select>
			</label>

			{#if filtering}
				<button type="button" class="clear-button" onclick={resetFilters}>
					<RotateCcw class="size-3.5" />
					Clear
				</button>
			{/if}
		</div>

		<p class="mb-3 text-xs text-muted-foreground" aria-live="polite">
			{visibleCount}
			{visibleCount === 1 ? 'question' : 'questions'}
		</p>

		{#if visibleSteps.length === 0}
			<p class="empty-state">No questions match these filters.</p>
		{:else}
			<div class="flex flex-col gap-4">
				{#each visibleSteps as step (step.id)}
					{@const progress = stepProgress(step.id)}
					{@const open = filtering || !closedSteps.has(step.id)}
					<section class="step-card" aria-labelledby="step-{step.id}">
						<button
							type="button"
							class="step-head"
							aria-expanded={open}
							aria-controls="step-body-{step.id}"
							onclick={() => toggleStep(step.id)}
						>
							<span class="min-w-0 flex-1 text-left">
								<span id="step-{step.id}" class="step-title">{step.title}</span>
								<span class="step-meta">{progress.solved} of {progress.total} solved</span>
							</span>
							<span
								class="bar step-bar"
								role="progressbar"
								aria-label="{step.title} progress"
								aria-valuemin={0}
								aria-valuemax={progress.total}
								aria-valuenow={progress.solved}
							>
								<span
									style="width: {progress.total ? (progress.solved / progress.total) * 100 : 0}%"
								></span>
							</span>
							<ChevronDown
								class="chevron size-4 shrink-0 {open ? 'open' : ''}"
								aria-hidden="true"
							/>
						</button>

						{#if open}
							<div id="step-body-{step.id}" class="px-1 pb-2">
								{#each step.topics as topic (topic.id)}
									<h2 class="topic-title">{topic.title}</h2>
									<div class="overflow-x-auto">
										<table class="problem-table">
											<thead>
												<tr>
													<th class="w-[26px]" aria-label="Status"></th>
													<th>Title</th>
													<th>Difficulty</th>
												</tr>
											</thead>
											<tbody>
												{#each topic.questions as question (question.id)}
													{@const status = getSheetStatus(
														question.id,
														solved.slugs,
														attempted.slugs
													)}
													<tr>
														<td class="status-cell">
															{#if status === 'solved'}
																<Check class="mx-auto size-4 text-[#3fb950]" aria-label="Solved" />
															{:else if status === 'attempted'}
																<span role="img" aria-label="Attempted" class="text-[#d29922]"
																	>●</span
																>
															{/if}
														</td>
														<td>
															<a
																href={resolve('/ide/[id]', { id: question.id })}
																class="problem-link"
															>
																{question.title}
															</a>
															{#each question.tags.filter((tag) => tag !== 'dsa-sheet' && tag !== 'basics') as tag (tag)}
																<span class="tag">{tag}</span>
															{/each}
														</td>
														<td>
															<span class="difficulty-badge {question.difficulty}">
																{question.difficulty}
															</span>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/each}
			</div>
		{/if}
	</div>
</main>

<style>
	.progress-card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px 24px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--secondary);
		padding: 18px;
	}

	.bar {
		display: block;
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background: var(--border);
	}

	.bar span {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: #3fb950;
		transition: width 200ms;
	}

	.continue-button {
		display: inline-flex;
		max-width: 100%;
		align-items: center;
		gap: 8px;
		border-radius: 6px;
		background: var(--primary);
		padding: 10px 16px;
		color: var(--primary-foreground);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.8rem;
		text-decoration: none;
	}

	.continue-button:hover {
		opacity: 0.9;
	}

	.step-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--background);
	}

	.step-head {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 16px;
		border: 0;
		background: transparent;
		padding: 14px 16px;
		color: var(--foreground);
		font: inherit;
		cursor: pointer;
	}

	.step-head:hover {
		background: var(--secondary);
	}

	.step-title {
		display: block;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 1rem;
		font-weight: 600;
	}

	.step-meta {
		display: block;
		margin-top: 2px;
		color: var(--muted-foreground);
		font-size: 0.75rem;
	}

	.step-bar {
		width: 120px;
		flex: 0 0 120px;
	}

	:global(.chevron) {
		color: var(--muted-foreground);
		transition: transform 150ms;
	}

	:global(.chevron.open) {
		transform: rotate(180deg);
	}

	.topic-title {
		margin: 14px 12px 2px;
		color: var(--muted-foreground);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.search-field {
		position: relative;
		min-width: 180px;
		flex: 1;
	}

	.search-field input {
		width: 100%;
		height: 38px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--secondary);
		padding: 0 12px 0 36px;
		color: var(--foreground);
		font: inherit;
		font-size: 0.78rem;
	}

	.search-field input:focus {
		border-color: var(--primary);
		outline: 1px solid var(--primary);
	}

	.search-field :global(svg) {
		color: var(--muted-foreground);
	}

	.filter-select {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.filter-select select {
		display: inline-flex;
		height: 38px;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--secondary);
		padding: 0 12px 0 34px;
		color: var(--foreground);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.filter-select select:hover {
		border-color: var(--primary);
	}

	.filter-select :global(.filter-icon) {
		position: absolute;
		z-index: 1;
		left: 11px;
		width: 15px;
		height: 15px;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	.clear-button {
		display: inline-flex;
		height: 38px;
		align-items: center;
		gap: 7px;
		border: 0;
		background: transparent;
		padding: 0 8px;
		color: var(--muted-foreground);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.clear-button:hover {
		color: var(--foreground);
	}

	.problem-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.problem-table thead th {
		border-bottom: 1px solid var(--border);
		padding: 8px 10px;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		font-weight: normal;
		text-align: left;
	}

	.problem-table tbody tr {
		border-bottom: 1px solid var(--border);
	}

	.problem-table tbody tr:hover {
		background: var(--secondary);
	}

	.problem-table tbody tr:last-child {
		border-bottom: 0;
	}

	.problem-table tbody td {
		padding: 11px 10px;
		vertical-align: middle;
	}

	.status-cell {
		width: 26px;
		text-align: center;
	}

	.problem-link {
		color: var(--foreground);
		text-decoration: none;
	}

	.problem-link:hover {
		color: var(--primary);
	}

	.tag {
		display: inline-block;
		margin-left: 8px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: color-mix(in srgb, var(--muted) 50%, var(--background));
		padding: 2px 7px;
		color: var(--muted-foreground);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.68rem;
	}

	.difficulty-badge {
		display: inline-block;
		border-radius: 12px;
		padding: 3px 10px;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.difficulty-badge.Beginner {
		background: rgb(63 185 80 / 10%);
		color: color-mix(in srgb, #3fb950 70%, var(--foreground));
	}

	.difficulty-badge.Intermediate {
		background: rgb(210 153 34 / 10%);
		color: color-mix(in srgb, #d29922 70%, var(--foreground));
	}

	.difficulty-badge.Advanced {
		background: rgb(229 83 75 / 10%);
		color: color-mix(in srgb, #e5534b 75%, var(--foreground));
	}

	.empty-state {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 48px 12px;
		color: var(--muted-foreground);
		font-size: 0.85rem;
		text-align: center;
	}

	@media (max-width: 640px) {
		.step-bar {
			display: none;
		}

		.problem-table thead {
			display: none;
		}

		.problem-table tbody td {
			display: block;
			padding: 3px 10px;
		}

		.problem-table tbody tr {
			display: block;
			padding: 10px 0;
		}

		.status-cell {
			float: left;
			width: 30px;
			padding-top: 5px !important;
		}
	}
</style>
