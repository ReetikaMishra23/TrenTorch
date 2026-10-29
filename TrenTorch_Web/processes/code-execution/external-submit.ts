import type { Writable } from 'svelte/store';
import type { ExecutionResult, SubmissionResult } from '$data/curriculum/types';
import { runExternalCustom, runExternalTests, type ExternalRunner } from './external-tests';

/** The stores of a language service that a submission writes to (the same ones PyodideService.runTests uses). */
export interface SubmitStores {
	consoleOutput: Writable<string>;
	consoleError: Writable<boolean>;
	isRunning: Writable<boolean>;
	testResults: Writable<SubmissionResult | null>;
}

/**
 * Submit (or "Run", with a sample limit) for a language that is not Python. Fills the console and the
 * results the way a Python submission does, so the page treats every language the same.
 */
export async function submitExternal(
	stores: SubmitStores,
	runner: ExternalRunner,
	code: string,
	harness: string,
	contentId: string,
	sampleLimit?: number
): Promise<SubmissionResult> {
	stores.isRunning.set(true);
	stores.consoleError.set(false);
	stores.consoleOutput.set(
		sampleLimit
			? `Running the first ${sampleLimit} checks for [${contentId}]...\n`
			: `Running test suite for [${contentId}]...\n`
	);
	try {
		const result = await runExternalTests({
			runner,
			code,
			harness,
			contentId,
			sampleLimit,
			onProgress: (message) => stores.consoleOutput.set(message)
		});
		stores.consoleError.set(Boolean(result.error));
		stores.testResults.set(result);
		if (result.error) {
			stores.consoleOutput.set(`Run failed before the tests could execute:\n\n${result.error}`);
		} else if (result.rawOutput.trim()) {
			stores.consoleOutput.set(result.rawOutput);
		} else {
			stores.consoleOutput.set(`${result.passedTests}/${result.totalTests} checks passed.`);
		}
		return result;
	} catch (err) {
		stores.consoleError.set(true);
		stores.consoleOutput.set(`[Error]: ${err instanceof Error ? err.message : String(err)}`);
		throw err;
	} finally {
		stores.isRunning.set(false);
	}
}

/** The custom-input box for a language that is not Python; fills the console like the Python one. */
export async function customExternal(
	stores: SubmitStores,
	runner: ExternalRunner,
	code: string,
	harness: string,
	contentId: string,
	functionName: string,
	argumentsJson: string,
	expectedJson: string
): Promise<ExecutionResult> {
	stores.isRunning.set(true);
	stores.consoleError.set(false);
	stores.consoleOutput.set(`Running custom input for [${contentId}]...\n`);
	try {
		const result = await runExternalCustom({
			runner,
			code,
			harness,
			functionName,
			argumentsJson,
			expectedJson,
			onProgress: (message) => stores.consoleOutput.set(message)
		});
		stores.consoleError.set(!result.success);
		stores.consoleOutput.set(
			[result.output, result.error && !result.output.includes(result.error) ? result.error : '']
				.filter(Boolean)
				.join('\n\n')
		);
		return result;
	} catch (err) {
		stores.consoleError.set(true);
		stores.consoleOutput.set(`[Error]: ${err instanceof Error ? err.message : String(err)}`);
		throw err;
	} finally {
		stores.isRunning.set(false);
	}
}
