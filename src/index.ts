import { App } from "./core/App";
import { logger } from "./utils/logger";

const app = new App();

try {
  await app.bootstrap();
  app.listen();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await app.shutdown();
      process.exit(0);
    });
  }
} catch (error) {
  logger.fatal({ error }, "Failed to bootstrap app");
  process.exit(1);
}
