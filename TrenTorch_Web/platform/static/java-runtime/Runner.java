import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;

// Driver run inside CheerpJ: compiles /str/Main.java with the system compiler,
// loads the result, calls its main(String[]), and writes everything that would
// have gone to stdout/stderr (compiler diagnostics, program output, uncaught
// exceptions) into one file CheerpJ's JS side can read back afterwards, since
// CheerpJ gives no documented way to intercept System.out/System.err directly.
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

			JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
			if (compiler == null) {
				captured.println("error: no Java compiler available in this runtime");
			} else {
				ByteArrayOutputStream compileLog = new ByteArrayOutputStream();
				PrintStream compileLogStream = new PrintStream(compileLog, true, "UTF-8");
				int rc = compiler.run(null, compileLogStream, compileLogStream, "-d", workDir.toString(),
						srcFile.toString());
				if (rc != 0) {
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
