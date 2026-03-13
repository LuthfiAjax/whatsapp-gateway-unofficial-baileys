import { mkdirSync, createWriteStream, type WriteStream } from "node:fs";
import { join } from "node:path";
import { Writable } from "node:stream";
import pino from "pino";
import { config } from "../config/env";

const LOG_DIR = join(process.cwd(), "logs");

function getLogFileName(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}.log`;
}

class DailyFileStream extends Writable {
  private currentDate = "";
  private stream: WriteStream | null = null;

  public constructor() {
    super();
    mkdirSync(LOG_DIR, { recursive: true });
  }

  public override _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      const stream = this.getStream();
      if (!stream.write(chunk, encoding)) {
        stream.once("drain", callback);
        return;
      }
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error("Failed to write log"));
    }
  }

  public override _final(callback: (error?: Error | null) => void): void {
    if (!this.stream) {
      callback();
      return;
    }

    this.stream.end(callback);
  }

  private getStream(): WriteStream {
    const today = getLogFileName(new Date());
    if (this.stream && this.currentDate === today) {
      return this.stream;
    }

    this.stream?.end();
    this.currentDate = today;
    this.stream = createWriteStream(join(LOG_DIR, today), { flags: "a" });
    return this.stream;
  }
}

const destination = new DailyFileStream();

export const logger = pino(
  {
    level: config.nodeEnv === "production" ? "info" : "debug"
  },
  destination
);

export async function flushLogger(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    destination.end((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
