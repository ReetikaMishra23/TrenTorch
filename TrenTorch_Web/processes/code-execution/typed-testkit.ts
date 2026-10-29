// Shared by the per-language driver specs: runs runTyped with a language's executor and gathers what the
// page would receive.
import { runTyped, type TypedExecutor } from './typed-run';
import type { TypedLanguage } from './external-codec';
import type {
	ExternalCall,
	ExternalFunction,
	ExternalPlan,
	ExternalRecord
} from './external-protocol';

export const call = (args: unknown[], extra: Partial<ExternalCall> = {}): ExternalCall => ({
	key: '',
	case: 'k',
	index: 0,
	args,
	limitMs: 1000,
	perf: false,
	reads: false,
	batch: false,
	...extra
});

export const fn = (
	name: string,
	params: [string, string][],
	returns: string
): ExternalFunction => ({
	name,
	params: params.map(([n, type]) => ({ name: n, type })),
	returns
});

/** The answer a record carries, from its JSON text. */
export const answer = (record: ExternalRecord | undefined) =>
	record && 'outJson' in record ? JSON.parse(record.outJson) : undefined;

export interface TypedOutcome {
	records: Record<string, ExternalRecord>;
	/** In the order of the calls given. */
	list: (ExternalRecord | undefined)[];
	printed: string;
	done: boolean;
	crash?: string;
	failed?: string;
}

export async function runTypedPlan(options: {
	language: TypedLanguage;
	source: string;
	function: ExternalFunction;
	calls: ExternalCall[];
	buildDriver: (source: string, plan: ExternalPlan, code: string) => string;
	executor: TypedExecutor;
	chunkByCase?: boolean;
}): Promise<TypedOutcome> {
	// Each call gets its own key; calls that share a case name are run together when chunking by case.
	const calls = options.calls.map((c, i) => ({ ...c, key: `${c.case}:${i}`, index: i }));
	const plan: ExternalPlan = { function: options.function, compare: 'exact', calls };
	const outcome: TypedOutcome = { records: {}, list: [], printed: '', done: false };
	await runTyped({
		language: options.language,
		source: options.source,
		plan,
		buildDriver: options.buildDriver,
		executor: options.executor,
		chunkByCase: options.chunkByCase,
		post: (m) => {
			if (m.type === 'external_record')
				outcome.records[m.key as string] = m.record as ExternalRecord;
			else if (m.type === 'external_stdout') outcome.printed += m.text as string;
			else if (m.type === 'external_done') {
				outcome.done = true;
				outcome.crash = m.crash as string | undefined;
			} else if (m.type === 'external_failed') outcome.failed = m.error as string;
		}
	});
	outcome.list = calls.map((c) => outcome.records[c.key]);
	return outcome;
}
