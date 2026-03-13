import { flushLogger, logger } from "./utils/logger";

process.emitWarning = (() => undefined) as typeof process.emitWarning;
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: any, encoding?: any, callback?: any) => {
  const message = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  if (
    message.includes("[bun] Warning: ws.WebSocket 'upgrade' event is not implemented in bun") ||
    message.includes("[bun] Warning: ws.WebSocket 'unexpected-response' event is not implemented in bun")
  ) {
    if (typeof encoding === "function") {
      encoding();
    } else if (typeof callback === "function") {
      callback();
    }
    return true;
  }
  return originalStderrWrite(chunk, encoding, callback);
}) as typeof process.stderr.write;

const { App } = await import("./core/App");

const app = new App();

try {
  await app.bootstrap();
  app.listen();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await app.shutdown();
      await flushLogger();
      process.exit(0);
    });
  }
} catch (error) {
  logger.fatal({ error }, "Failed to bootstrap app");
  await flushLogger().catch(() => undefined);
  process.exit(1);
}
