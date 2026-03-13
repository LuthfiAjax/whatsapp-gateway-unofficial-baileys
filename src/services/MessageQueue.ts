import { logger } from "../utils/logger";

interface QueueJob {
  id: string;
  run: () => Promise<any>;
  availableAt: number;
  attempts: number;
  maxAttempts: number;
  resolve?: (value: any) => void;
  reject?: (error: unknown) => void;
}

export class MessageQueue {
  private readonly queue: QueueJob[] = [];
  private processing = false;
  private timer: Timer | null = null;

  public enqueue<T>(job: Omit<QueueJob, "attempts" | "resolve" | "reject">): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ ...job, attempts: 0, resolve, reject });
      this.schedule();
    });
  }

  public enqueueFireAndForget(job: Omit<QueueJob, "attempts" | "resolve" | "reject">): void {
    this.queue.push({ ...job, attempts: 0 });
    this.schedule();
  }

  private schedule(): void {
    if (this.processing) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const next = this.queue.sort((left, right) => left.availableAt - right.availableAt)[0];
    if (!next) {
      return;
    }
    this.timer = setTimeout(() => void this.process(), Math.max(0, next.availableAt - Date.now()));
  }

  private async process(): Promise<void> {
    this.processing = true;
    this.timer = null;

    while (this.queue.length > 0) {
      this.queue.sort((left, right) => left.availableAt - right.availableAt);
      const next = this.queue[0];
      if (!next) {
        break;
      }
      const wait = next.availableAt - Date.now();
      if (wait > 0) {
        this.processing = false;
        this.schedule();
        return;
      }

      this.queue.shift();
      try {
        const result = await next.run();
        next.resolve?.(result);
      } catch (error) {
        next.attempts += 1;
        if (next.attempts >= next.maxAttempts) {
          next.reject?.(error);
          logger.error({ error, jobId: next.id }, "Queue job failed");
          continue;
        }
        this.queue.push({ ...next, availableAt: Date.now() + 500 * 2 ** next.attempts });
      }
    }

    this.processing = false;
  }
}
