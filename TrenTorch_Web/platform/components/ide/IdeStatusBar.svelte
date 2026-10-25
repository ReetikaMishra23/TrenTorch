<script lang="ts">
	import type { RuntimeState } from '$data/curriculum/types';
	import { ideTheme } from './ide-theme.svelte';

	let {
		runtimeState = 'ready',
		runtimeText = '',
		language = 'Python',
		line = 1,
		col = 1,
		saved = false,
		fontSize = 14
	} = $props<{
		runtimeState: RuntimeState;
		runtimeText: string;
		language?: string;
		line?: number;
		col?: number;
		saved?: boolean;
		fontSize?: number;
	}>();

	const loading = $derived(
		runtimeState === 'loading_runtime' || runtimeState === 'loading_packages'
	);
</script>

<!-- A thin status line under the workbench, like an editor's: what the runtime is
     doing on the left, where the cursor is on the right. -->
<footer
	class="flex h-7 shrink-0 items-center justify-between gap-4 px-4 text-[11px] text-muted-foreground"
>
	<div class="flex min-w-0 items-center gap-4">
		<span class="flex items-center gap-1.5 whitespace-nowrap">
			<span
				class="size-1.5 rounded-full {loading ? 'animate-pulse' : ''}"
				style:background={runtimeState === 'error'
					? 'var(--ide-bad)'
					: loading
						? 'var(--ide-warn)'
						: 'var(--ide-ok)'}
				aria-hidden="true"
			></span>
			<span class="truncate">{runtimeText}</span>
		</span>
		<span class="hidden whitespace-nowrap sm:inline">{language}</span>
	</div>
	<div class="flex items-center gap-4 whitespace-nowrap">
		<span class="hidden items-center gap-1.5 md:flex">
			<kbd class="kbd">⇧ Enter</kbd> run
		</span>
		<span class="hidden items-center gap-1.5 lg:flex">
			<kbd class="kbd">Ctrl</kbd><kbd class="kbd">+ −</kbd> size
		</span>
		<span class="hidden sm:inline">{fontSize}px</span>
		<span class="hidden sm:inline">{ideTheme.current.name}</span>
		<span class="tabular-nums">Ln {line}, Col {col}</span>
		{#if saved}
			<span class="text-(--ide-ok)">Saved</span>
		{/if}
	</div>
</footer>

<style>
	.kbd {
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--secondary);
		padding: 0 5px;
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 16px;
		color: var(--muted-foreground);
	}
</style>
