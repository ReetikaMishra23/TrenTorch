<script lang="ts">
	// Test-only: binds FilterBar the way the Problemset and DSA pages do, and prints what it bound.
	import FilterBar from './FilterBar.svelte';

	let { mode = 'full', resultCount = 349 }: { mode?: 'full' | 'lean'; resultCount?: number } =
		$props();

	let query = $state('');
	let moduleId = $state('');
	let topic = $state('');
	let company = $state('');
	let difficulty = $state('');
	let status = $state('all');
	let pastPotd = $state(false);

	const difficulties = ['Beginner', 'Intermediate', 'Advanced'];
	const statuses = [
		{ value: 'all', label: 'All statuses' },
		{ value: 'solved', label: 'Solved' },
		{ value: 'attempted', label: 'Attempted' },
		{ value: 'unsolved', label: 'Unsolved' }
	];
</script>

{#if mode === 'full'}
	<FilterBar
		bind:query
		bind:moduleId
		bind:topic
		bind:company
		bind:difficulty
		bind:status
		bind:pastPotd
		modules={[
			{ id: 'dl', title: 'Deep Learning', learningPartId: 'part-deep-learning' },
			{ id: 'ml', title: 'Classical ML', learningPartId: 'part-classical-ml' }
		]}
		topics={[
			{ value: 'ab', label: 'A/B Testing', count: 2 },
			{ value: 'attention', label: 'Attention mechanism', count: 5 },
			{ value: 'cnn', label: 'CNN', count: 3 }
		]}
		companies={[
			{ value: 'AWS', label: 'AWS', count: 1 },
			{ value: 'Adobe', label: 'Adobe', count: 4 }
		]}
		{difficulties}
		{statuses}
		{resultCount}
	/>
{:else}
	<FilterBar
		bind:query
		bind:difficulty
		bind:status
		{difficulties}
		{statuses}
		{resultCount}
		placeholder="Search questions or tags..."
		noun="question"
	/>
{/if}

<output data-testid="bound">
	{JSON.stringify({ query, moduleId, topic, company, difficulty, status, pastPotd })}
</output>
