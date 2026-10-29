import { STUDENT_CODE_MARKER } from '../ide-content/harness-marker';
import { SETUP_SCRIPT } from './pyodide-setup-script';

// The Python the Pyodide worker runs to prepare and to judge a submission in another language (see
// external-protocol.ts). Both load the question's test file the way a Python submission does, minus the
// student's code, and use what cases-runtime.py gives them: external_prepare, EXTERNAL and run_tests.
// Kept in one place so the worker and pyodide-check/external-seam.spec.ts cannot drift apart.

const LOAD_TESTS = `
def __load_tests(test_b64):
    import base64
    raw_test = base64.b64decode(test_b64).decode("utf-8")
    marker = ${JSON.stringify(STUDENT_CODE_MARKER)}
    before_code, _, test_code = raw_test.partition(marker) if marker in raw_test else ("", "", raw_test)
    scope = {"__name__": "__main__"}
    exec(before_code, scope)
    exec(compile(test_code, "<trentorch-tests>", "exec"), scope)
    if "external_prepare" not in scope:
        raise RuntimeError("This question's tests cannot be run outside Python.")
    return scope
`;

/** Step 1: every call the tests make, as JSON text. `maxInt` is the text of the largest integer the language holds, or "". */
export function buildExternalPrepareScript(options: {
	testB64: string;
	/** Digits of the test limit for "Run", empty for the whole suite. */
	limitArg: string;
	maxInt: string;
}): string {
	const { testB64, limitArg, maxInt } = options;
	return `${SETUP_SCRIPT}
${LOAD_TESTS}
def __prepare():
    try:
        scope = __load_tests(${JSON.stringify(testB64)})
        limit = ${limitArg || 'None'}
        max_int = ${maxInt ? `int(${JSON.stringify(maxInt)})` : 'None'}
        return {"plan": scope["external_prepare"](scope["_PROBLEM"], limit, max_int), "error": None}
    except Exception:
        return {"plan": None, "error": traceback.format_exc()}

json.dumps(__prepare())
`;
}

/** Step 3: judge what the language answered. The records are JSON text, keyed as external-protocol.ts says. */
export function buildExternalJudgeScript(options: {
	testB64: string;
	limitArg: string;
	/** JSON text of the ExternalOutputs, base64 encoded. */
	outputsB64: string;
}): string {
	const { testB64, limitArg, outputsB64 } = options;
	return `${SETUP_SCRIPT}
${LOAD_TESTS}
def __judge():
    import base64, sys
    # An answer such as fibonacci(50000) has more digits than Python reads from text by default.
    sys.set_int_max_str_digits(0)
    try:
        scope = __load_tests(${JSON.stringify(testB64)})
        scope["EXTERNAL"]["outputs"] = json.loads(base64.b64decode(${JSON.stringify(outputsB64)}).decode("utf-8"))
        scope["EXTERNAL"]["returns"] = scope["_PROBLEM"]["function"]["returns"]
        # The generated tests look the student's function up by name before checking a case. Nothing is
        # called: the answers are already in EXTERNAL.
        scope[scope["_PROBLEM"]["function"]["name"]] = lambda *args: None
        results = scope["run_tests"](${limitArg || 'None'})
        return {"results": results, "notes": scope["EXTERNAL"]["notes"], "error": None}
    except Exception:
        return {"results": [], "notes": [], "error": traceback.format_exc()}

json.dumps(__judge())
`;
}
