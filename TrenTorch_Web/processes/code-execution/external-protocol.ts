// How a DSA submission is judged when the student's code is not Python.
//
// Python stays the referee. cases-runtime.py makes every input (external_prepare) and judges every answer
// (check_case), so each language gets the same cases, the same comparison and the same messages. The student's
// language only calls their function on the inputs it is given. A submission is three steps:
//
//   1. Python prepares the calls                  -> ExternalPlan
//   2. the language runs the student's function   -> a record per call (ExternalRecord)
//   3. Python judges the records                  -> SubmissionResult, the same as a Python submission
//
// This file is the vocabulary the three steps share. See external-tests.ts for the orchestration.

/** What the problem says about the function the student writes (problem.json's "function"). */
export interface ExternalFunction {
	name: string;
	params: { name: string; type: string }[];
	returns: string;
}

/** An integer in the plan: a number, or {"$int": "digits"} when it is too big for a JavaScript number. */
export type WireInt = number | { $int: string };

/** A linked list argument: its values, where the tail loops back to (-1 for nowhere), and where it joins another list. */
export interface WireList {
	values: WireInt[];
	cycle: number;
	join: { param: string; index: number } | null;
}

/** One call to make. `args` are plain JSON in parameter order; trees are level-order lists with null for a missing child. */
export interface ExternalCall {
	/** "<case id>:<index>", the key the answer comes back under. */
	key: string;
	case: string;
	index: number;
	args: unknown[];
	/** The time limit of the case, in milliseconds. For a random batch it is the limit for all of its calls together. */
	limitMs: number;
	perf: boolean;
	/** Whether the case limits how many values the code may read from its lists. */
	reads: boolean;
	batch: boolean;
	/** Set when this language cannot run the call; the reason is shown to the student. */
	unsupported?: string;
}

export interface ExternalPlan {
	function: ExternalFunction;
	compare: 'exact' | 'unordered' | 'float';
	calls: ExternalCall[];
}

/** What a language reported for one call. No record at all means the program never got that far. */
export type ExternalRecord =
	| { out: unknown; ms: number; reads: number | null }
	// The answer as JSON text, for a language whose integers can be bigger than a JavaScript number holds.
	| { outJson: string; ms: number; reads: number | null }
	// `fatal`: the program died on this call, so nothing after it ran.
	| { error: string; fatal?: boolean }
	| { skip: true }
	| { unsupported: string };

export type ExternalOutputs = Record<string, ExternalRecord>;

/** What Python says after judging: the same per-test results a Python submission has, plus what could not be checked. */
export interface ExternalJudgement {
	results: { name: string; passed: boolean; skipped?: boolean; error: string | null }[];
	notes: string[];
	error: string | null;
}

/**
 * The largest integer a language can hold exactly, or null for no limit. JavaScript numbers are doubles
 * (exact to 2^53 - 1); the typed languages use 64 bits, a little less than 2^63, which does not fit in a
 * JavaScript number, so it is given as the text Python reads.
 */
export const MAX_INT: Record<string, number | string | null> = {
	javascript: Number.MAX_SAFE_INTEGER,
	cpp: '9223372036854775807',
	java: '9223372036854775807',
	go: '9223372036854775807',
	rust: '9223372036854775807'
};
