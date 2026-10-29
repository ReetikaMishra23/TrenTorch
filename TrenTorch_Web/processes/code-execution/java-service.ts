import { writable, type Writable } from 'svelte/store';
import type {
	ExecutionResult,
	PreviewFigure,
	RuntimeState,
	SubmissionResult
} from '$data/curriculum/types';

import { customExternal, submitExternal } from './external-submit';
import { workerRunner } from './worker-runner';

/* eslint-disable @typescript-eslint/no-explicit-any */

class JavaService {
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
			// Classic (non-module) worker: CheerpJ's loader.js is loaded via
			// importScripts, which module workers cannot call.
			this.worker = new Worker(new URL('./java-worker.ts', import.meta.url));

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
				console.error('Java worker error', err);
				this.runtimeState.set('error');
				this.isRunning.set(false);
			};

			this.worker.postMessage({ id: ++this.requestId, action: 'init' });
		} catch (err) {
			console.error('Failed to instantiate Java worker', err);
			this.runtimeState.set('error');
		}
	}

	public async runCode(code: string): Promise<ExecutionResult> {
		this.init();
		this.isRunning.set(true);
		this.consoleError.set(false);
		this.consoleOutput.set(
			'Starting Java (the first run downloads the compiler; each run compiles, which takes about 10 seconds)...\n'
		);

		return new Promise((resolve, reject) => {
			const id = ++this.requestId;
			const timeout = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					this.isRunning.set(false);
					this.consoleOutput.set('[Timeout]: Execution exceeded 2 minutes.');
					reject(new Error('Execution timed out'));
				}
			}, 120000);

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

	// Submit and Run: the tests are made and judged by Python; the student's function runs in the java worker.
	public runTests(
		code: string,
		testHarnessCode: string,
		contentId: string,
		sampleLimit?: number
	): Promise<SubmissionResult> {
		this.init();
		return submitExternal(this, this.runner, code, testHarnessCode, contentId, sampleLimit);
	}

	public runCustomTest(
		code: string,
		testHarnessCode: string,
		contentId: string,
		functionName: string,
		argumentsJson: string,
		expectedJson: string
	): Promise<ExecutionResult> {
		this.init();
		return customExternal(
			this,
			this.runner,
			code,
			testHarnessCode,
			contentId,
			functionName,
			argumentsJson,
			expectedJson
		);
	}

	private runner = workerRunner({
		language: 'java',
		worker: () => {
			this.init();
			return this.worker as Worker;
		},
		// A program stuck in a loop cannot be interrupted from inside: end the whole worker.
		discard: () => {
			this.worker?.terminate();
			this.worker = null;
			this.runtimeState.set('uninitialized');
			this.init();
		}
	});
}

export const javaService = new JavaService();
