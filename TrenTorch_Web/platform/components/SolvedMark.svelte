<script lang="ts">
	import { Check } from '@lucide/svelte';

	let {
		isSolved,
		questionTitle,
		class: className = '',
		title = undefined
	}: { isSolved: boolean; questionTitle: string; class?: string; title?: string } = $props();
</script>

<!-- Read-only solved indicator, shared by QuestionRow and the IDE's problem
     drawer. Solved state is earned on Submit, never set from here. -->
<div
	class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border {isSolved
		? 'border-primary bg-primary text-primary-foreground'
		: 'border-input'} {className}"
	role="img"
	aria-label={isSolved ? `'${questionTitle}' is solved` : `'${questionTitle}' is not solved yet`}
	{title}
>
	{#if isSolved}
		<Check class="size-3.5" />
	{/if}
</div>
