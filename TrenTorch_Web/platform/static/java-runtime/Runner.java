import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.eclipse.jdt.internal.compiler.batch.Main;

// Driver run inside CheerpJ: compiles /str/Main.java with ECJ (the Eclipse
// batch compiler, vendored as ecj.jar, since CheerpJ's bundled JRE has no
// javax.tools.ToolProvider.getSystemJavaCompiler()), loads the result, calls
// its main(String[]), and writes everything that would have gone to
// stdout/stderr (compiler diagnostics, program output, uncaught exceptions)
// into one file CheerpJ's JS side can read back afterwards, since CheerpJ
// gives no documented way to intercept System.out/System.err directly.
public class Runner {
	public static void main(String[] args) throws Exception {
		String srcPath = args.length > 0 ? args[0] : "/str/Main.java";
		String outPath = args.length > 1 ? args[1] : "/files/output.txt";

		ByteArrayOutputStream buf = new ByteArrayOutputStream();
		PrintStream captured = new PrintStream(buf, true, "UTF-8");
		PrintStream realOut = System.out;
		PrintStream realErr = System.err;
		System.setOut(captured);
		System.setErr(captured);

		try {
			String code = new String(Files.readAllBytes(Paths.get(srcPath)), "UTF-8");
			Path workDir = Paths.get("/files/work");
			Files.createDirectories(workDir);
			Path srcFile = workDir.resolve("Main.java");
			Files.write(srcFile, code.getBytes("UTF-8"));

			ByteArrayOutputStream compileLog = new ByteArrayOutputStream();
			PrintWriter compileLogWriter = new PrintWriter(new PrintStream(compileLog, true, "UTF-8"));
			String[] compileArgs = new String[] { "-source", "1.8", "-target", "1.8", "-proc:none", "-bootclasspath",
					"/str/rt.jar", "-d", workDir.toString(), srcFile.toString() };
			Main compiler = new Main(compileLogWriter, compileLogWriter, false);
			boolean compileOk = compiler.compile(compileArgs);
			compileLogWriter.flush();

			if (!compileOk) {
				captured.print(compileLog.toString("UTF-8"));
			} else {
				URLClassLoader loader = URLClassLoader.newInstance(new URL[] { workDir.toUri().toURL() });
				Class<?> mainClass = Class.forName("Main", true, loader);
				Method main = mainClass.getMethod("main", String[].class);
				try {
					main.invoke(null, new Object[] { new String[0] });
				} catch (InvocationTargetException ite) {
					Throwable cause = ite.getCause() != null ? ite.getCause() : ite;
					captured.println("Exception in thread \"main\" " + cause);
					for (StackTraceElement ste : cause.getStackTrace()) {
						captured.println("\tat " + ste);
					}
				}
			}
		} catch (Exception e) {
			captured.println("error: " + e);
		} finally {
			System.setOut(realOut);
			System.setErr(realErr);
			Files.write(Paths.get(outPath), buf.toByteArray());
		}
	}
}
