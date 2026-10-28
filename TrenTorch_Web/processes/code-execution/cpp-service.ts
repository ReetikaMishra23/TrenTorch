import { writable, type Writable } from 'svelte/store';
import type {
	ExecutionResult,
	PreviewFigure,
	RuntimeState,
	SubmissionResult
} from '$data/curriculum/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Same shape as JsService; backed by cpp-worker.ts, which lazy-loads JSCPP
// from jsDelivr on the first run instead of at page load.
class CppService {
	private worker: Worker | null = null;
	private requestId = 0;
	private pendingRequests = new Map<
		number,
		{ resolve: (val: any) => void; reject: (err: any) => void }
	>();

	public runtimeState: Writable<RuntimeState> = writable('uninitialized');
	public consoleOutput: Writable<string> = writable('');
	public consoleError: Writable<boolean> = writable(false);
	public testResults: Writable<SubmissionResult | null> = writable(null);
	public isRunning: Writable<boolean> = writable(false);
	public consoleFigures: Writable<PreviewFigure[]> = writable([]);

	public init(): void {
		if (typeof window === 'undefined' || this.worker) return;
		try {
			this.runtimeState.set('loading_runtime');
			// Classic (non-module) worker: it loads its runtime with importScripts, which
			// module workers cannot call.
			this.worker = new Worker(new URL('./cpp-worker.ts', import.meta.url));

			this.worker.onmessage = (e: MessageEvent) => {
				const { id, type, status, output, error, success, durationMs } = e.data;

				if (type === 'status') {
					this.runtimeState.set(status as RuntimeState);
					return;
				}

				if (type === 'run_result') {
					this.isRunning.set(false);
					this.consoleError.set(Boolean(error));
					const req = this.pendingRequests.get(id);
					if (req) {
						this.pendingRequests.delete(id);
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
					const req = this.pendingRequests.get(id);
					if (req) {
						this.pendingRequests.delete(id);
						req.reject(new Error(error));
					}
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
		this.consoleOutput.set('Compiling and running C++ (JSCPP)...\n');

		return new Promise((resolve, reject) => {
			const id = ++this.requestId;
			const timeout = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					this.isRunning.set(false);
					this.consoleOutput.set('[Timeout]: Execution exceeded 20 seconds.');
					reject(new Error('Execution timed out'));
				}
			}, 20000);

			this.pendingRequests.set(id, {
				resolve: (res) => {
					clearTimeout(timeout);
					resolve(res);
				},
				reject: (err) => {
					clearTimeout(timeout);
					reject(err);
				}
			});

			this.worker?.postMessage({ id, action: 'run', code });
		});
	}

	public async runPreview(): Promise<{ output: string; error?: string; figures: PreviewFigure[] }> {
		return { output: '', figures: [] };
	}

	public async runTests(): Promise<SubmissionResult> {
		throw new Error('Submit is only available in Python for now. Switch the language to test your solution.');
	}

	public async runCustomTest(): Promise<ExecutionResult> {
		throw new Error('Custom runs are only available in Python for now.');
	}
}

export const cppService = new CppService();
