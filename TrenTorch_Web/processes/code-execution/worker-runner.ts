import type { ExternalPlan } from './external-protocol';
import type { ExternalRunner } from './external-tests';

// The messages every language worker uses to run a submission (the worker side lives in each *-worker.ts,
// which posts these as it goes). The page side is this one adapter, so all five languages stream their
// answers, report a build error and are stopped the same way.
//
//   page   -> worker  { id, action: 'external', code, plan }
//   worker -> page    { type: 'external_progress', message }   loading / building
//                     { type: 'external_started' }              the first call is about to be made
//                     { type: 'external_record', key, record }  one call answered
//                     { type: 'external_stdout', text }         what the student printed
//                     { type: 'external_done', crash? }         the program ended; `crash` says why it died, if it did
//                     { type: 'external_failed', error }        the code does not build

export function workerRunner(options: {
	language: string;
	/** The live worker, starting it if needed. */
	worker: () => Worker;
	/** Terminate the worker and forget it, so the next use starts a fresh one. */
	discard: () => void;
}): ExternalRunner {
	let printed = '';
	let off: (() => void) | null = null;
	return {
		language: options.language,
		printed: () => printed,
		stop() {
			off?.();
			off = null;
			options.discard();
		},
		run(source: string, plan: ExternalPlan, hooks) {
			printed = '';
			const worker = options.worker();
			return new Promise((resolve, reject) => {
				const listener = (e: MessageEvent) => {
					const m = e.data;
					if (m.type === 'external_progress') hooks.progress(m.message);
					else if (m.type === 'external_started') hooks.started();
					else if (m.type === 'external_record') hooks.record(m.key, m.record);
					else if (m.type === 'external_stdout') printed += m.text;
					else if (m.type === 'external_done' || m.type === 'external_failed') {
						worker.removeEventListener('message', listener);
						off = null;
						if (m.type === 'external_done') resolve({ stdout: printed, crash: m.crash });
						else {
							// The runtime died on this code: start a new worker for the next run.
							if (m.restart) options.discard();
							reject(new Error(m.error));
						}
					}
				};
				worker.addEventListener('message', listener);
				off = () => worker.removeEventListener('message', listener);
				worker.postMessage({ id: 0, action: 'external', code: source, plan });
			});
		}
	};
}
