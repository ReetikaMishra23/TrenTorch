import { writable, type Writable } from 'svelte/store';
import type {
	ExecutionResult,
	PreviewFigure,
	RuntimeState,
	SubmissionResult
} from '$data/curriculum/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// How long a Run may spend downloading and unpacking the compiler (about 29 MB) before the program starts.
const LOAD_TIMEOUT_MS = 180_000;
// How long compiling and running may take once it has started. Compiled C++ cannot be interrupted from
// inside, so a program stuck in a loop is stopped by terminating the whole worker.
const RUN_TIMEOUT_MS = 30_000;

// Same shape as JsService; backed by cpp-worker.ts, which runs clang compiled to WebAssembly.
class CppService {
	private worker: Worker | null = null;
	private requestId = 0;
	private pendingRequests = new Map<
		number,
		{ resolve: (val: any) => void; reject: (err: any) => void }
	>();
	private timers = new Map<number, ReturnType<typeof setTimeout>>();

	public runtimeState: Writable<RuntimeState> = writable('uninitialized');
	public consoleOutput: Writable<string> = writable('');
	public consoleError: Writable<boolean> = writable(false);
	public testResults: Writable<SubmissionResult | null> = writable(null);
	public isRunning: Writable<boolean> = writable(false);
	public consoleFigures: Writable<PreviewFigure[]> = writable([]);

	private settle(
		id: number
	): { resolve: (val: any) => void; reject: (err: any) => void } | undefined {
		clearTimeout(this.timers.get(id));
		this.timers.delete(id);
		const request = this.pendingRequests.get(id);
		this.pendingRequests.delete(id);
		return request;
	}

	// `message` becomes the error the page shows, so it reads as the explanation ("[Run failed]: <message>").
	private armTimeout(id: number, ms: number, message: string): void {
		clearTimeout(this.timers.get(id));
		this.timers.set(
			id,
			setTimeout(() => {
				const request = this.settle(id);
				if (!request) return;
				// Stop the worker itself: the program may be spinning inside WebAssembly.
				this.worker?.terminate();
				this.worker = null;
				this.runtimeState.set('uninitialized');
				this.isRunning.set(false);
				this.consoleError.set(true);
				this.consoleOutput.set(`[Timeout]: ${message}`);
				request.reject(new Error(message));
			}, ms)
		);
	}

	public init(): void {
		if (typeof window === 'undefined' || this.worker) return;
		try {
			this.runtimeState.set('loading_runtime');
			this.worker = new Worker(new URL('./cpp-worker.ts', import.meta.url), { type: 'module' });

			this.worker.onmessage = (e: MessageEvent) => {
				const { id, type, status, output, error, success, durationMs } = e.data;

				if (type === 'status') {
					this.runtimeState.set(status as RuntimeState);
					// The compiler is loaded; from here the clock is for the program.
					if (status === 'running') {
						for (const pending of this.pendingRequests.keys()) {
							this.armTimeout(
								pending,
								RUN_TIMEOUT_MS,
								`The program ran for more than ${RUN_TIMEOUT_MS / 1000} seconds and was stopped. Is there an infinite loop?`
							);
						}
					}
					return;
				}

				if (type === 'run_result') {
					this.isRunning.set(false);
					this.consoleError.set(Boolean(error));
					const req = this.settle(id);
					if (req) {
						const formattedOut = [output || '', error || ''].filter(Boolean).join('\n\n');
						this.consoleOutput.set(formattedOut);
						req.resolve({
							success: Boolean(success),
							output: formattedOut,
							error,
							durationMs
						} as ExecutionResult);
					}
					return;
				}

				if (type === 'error') {
					this.isRunning.set(false);
					this.consoleError.set(true);
					const req = this.settle(id);
					if (req) req.reject(new Error(error));
					this.consoleOutput.update((prev) => prev + `\n[Error]: ${error}`);
				}
			};

			this.worker.onerror = (err) => {
				console.error('C++ worker error', err);
				this.runtimeState.set('error');
				this.isRunning.set(false);
			};

			this.worker.postMessage({ id: ++this.requestId, action: 'init' });
		} catch (err) {
			console.error('Failed to instantiate C++ worker', err);
			this.runtimeState.set('error');
		}
	}

	public async runCode(code: string): Promise<ExecutionResult> {
		this.init();
		this.isRunning.set(true);
		this.consoleError.set(false);
		this.consoleOutput.set('Compiling and running C++ (the first run downloads the compiler)...\n');

		return new Promise((resolve, reject) => {
			const id = ++this.requestId;
			this.pendingRequests.set(id, { resolve, reject });
			this.armTimeout(
				id,
				LOAD_TIMEOUT_MS,
				'The C++ compiler took too long to download. Check your connection and try again.'
			);
			this.worker?.postMessage({ id, action: 'run', code });
		});
	}

	public async runPreview(): Promise<{ output: string; error?: string; figures: PreviewFigure[] }> {
		return { output: '', figures: [] };
	}

	public async runTests(): Promise<SubmissionResult> {
		throw new Error(
			'Submit is only available in Python for now. Switch the language to test your solution.'
		);
	}

	public async runCustomTest(): Promise<ExecutionResult> {
		throw new Error('Custom runs are only available in Python for now.');
	}
}

export const cppService = new CppService();
