import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import {
	buildExternalPrepareScript,
	buildExternalJudgeScript
} from '$processes/code-execution/build-external-scripts';
import type {
	ExternalJudgement,
	ExternalOutputs,
	ExternalPlan
} from '$processes/code-execution/external-protocol';

// Shared by the specs that check the Python half of a non-Python submission (external-seam.spec.ts and
// external-judge.spec.ts).

const projectRoot = join(import.meta.dirname, '..');
export const toBase64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

export let py: PyodideInterface;

/** Starts Pyodide with numpy, which the test harness setup imports. Same CDN as questions.spec.ts. */
export async function startPyodide(): Promise<void> {
	const core = join(projectRoot, 'node_modules', 'pyodide') + '/';
	const lock = JSON.parse(readFileSync(join(core, 'pyodide-lock.json'), 'utf8'));
	const { version } = JSON.parse(readFileSync(join(core, 'package.json'), 'utf8'));
	py = await loadPyodide({ indexURL: core });
	await py.loadPackage(
		`https://cdn.jsdelivr.net/pyodide/v${version}/full/${lock.packages.numpy.file_name}`
	);
}

export async function prepare(harness: string, maxInt = '', limit = ''): Promise<ExternalPlan> {
	const raw = await py.runPythonAsync(
		buildExternalPrepareScript({ testB64: toBase64(harness), limitArg: limit, maxInt })
	);
	const parsed = JSON.parse(raw as string);
	if (parsed.error) throw new Error(parsed.error);
	return parsed.plan;
}

export async function judge(
	harness: string,
	outputs: ExternalOutputs,
	limit = ''
): Promise<ExternalJudgement> {
	const raw = await py.runPythonAsync(
		buildExternalJudgeScript({
			testB64: toBase64(harness),
			limitArg: limit,
			outputsB64: toBase64(typeof outputs === 'string' ? outputs : JSON.stringify(outputs))
		})
	);
	return JSON.parse(raw as string);
}

// What a correct program in another language would answer for every call of the plan: the reference
// solution on the same inputs, as plain JSON.
export async function referenceAnswers(
	harness: string,
	code: string,
	plan: ExternalPlan
): Promise<string> {
	py.globals.set('__harness_b64', toBase64(harness));
	py.globals.set('__code_b64', toBase64(code));
	py.globals.set('__keys', JSON.stringify(plan.calls.map((c) => c.key)));
	const raw = await py.runPythonAsync(`
import base64, json, sys
sys.set_int_max_str_digits(0)
def __answers():
    marker = "# __student_code_runs_here__"
    text = base64.b64decode(__harness_b64).decode("utf-8")
    before, _, tests = text.partition(marker)
    scope = {"__name__": "__main__"}
    exec(before, scope)
    exec(base64.b64decode(__code_b64).decode("utf-8"), scope)
    exec(tests, scope)
    problem = scope["_PROBLEM"]
    fn = scope[problem["function"]["name"]]
    by_key = {}
    for case in problem["cases"]:
        if "batch" in case:
            for i in range(len(case["digests"])):
                by_key[case["id"] + ":" + str(i)] = scope["batch_args"](problem, case["batch"], i)
        else:
            by_key[case["id"] + ":0"] = {k: scope["_materialize"](v) for k, v in case["input"].items()}
    out = {}
    for key in json.loads(__keys):
        out[key] = {"out": scope["call_fn"](problem, fn, by_key[key]), "ms": 1, "reads": None}
    return out
json.dumps(__answers())
`);
	return raw as string;
}
