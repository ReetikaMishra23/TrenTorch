package main

import (
	"bytes"
	"syscall/js"

	"github.com/traefik/yaegi/interp"
	"github.com/traefik/yaegi/stdlib"
)

// runGo(source string) -> {output: string, error: string|null}
// Exposed to the Worker as a global JS function; the source is Go code with
// a normal `package main` / `func main()`, run through the Yaegi interpreter.
func runGo(this js.Value, args []js.Value) interface{} {
	source := args[0].String()

	var out bytes.Buffer
	i := interp.New(interp.Options{Stdout: &out, Stderr: &out})
	i.Use(stdlib.Symbols)

	result := map[string]interface{}{"output": out.String(), "error": nil}

	_, err := i.Eval(source)
	if err == nil {
		_, err = i.Eval("main.main()")
	}
	result["output"] = out.String()
	if err != nil {
		result["error"] = err.Error()
	}
	return js.ValueOf(result)
}

func main() {
	js.Global().Set("runGo", js.FuncOf(runGo))
	// Keep the Go runtime alive so the exported function stays callable.
	select {}
}
