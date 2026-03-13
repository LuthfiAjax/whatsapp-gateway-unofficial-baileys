import { config } from "../config/env";
import type { DatabaseService } from "../database/DatabaseService";
import type { GatewayEvent } from "../types/events";
import { logger } from "../utils/logger";
import { parseJsonArray } from "../utils/validation";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WebhookDispatcher {
  public constructor(private readonly databaseService: DatabaseService) {}

  public dispatch(urls: Array<{ webhookId: string | null; url: string }>, event: GatewayEvent): void {
    for (const target of urls) {
      void this.sendWithRetry(target.webhookId, target.url, event);
    }
  }

  public getTargets(userId: string, sessionWebhookUrl: string | null, eventType: string): Array<{ webhookId: string | null; url: string }> {
    const databaseTargets: Array<{ webhookId: string | null; url: string }> = this.databaseService.webhooks
      .getActiveWebhooksForUser(userId)
      .filter((webhook) => {
        const events = parseJsonArray(webhook.events);
        return events.length === 0 || events.includes(eventType);
      })
      .map((webhook) => ({ webhookId: webhook.id, url: webhook.url }));

    if (sessionWebhookUrl) {
      databaseTargets.push({ webhookId: null, url: sessionWebhookUrl });
    }

    return databaseTargets;
  }

  private async sendWithRetry(webhookId: string | null, url: string, event: GatewayEvent): Promise<void> {
    const delivery = this.databaseService.webhookDeliveries.create({
      id: crypto.randomUUID(),
      webhookId,
      userId: event.userId,
      sessionId: event.sessionId,
      eventType: event.type,
      targetUrl: url,
      payload: JSON.stringify(event),
      status: "pending",
      httpStatus: null,
      responseBody: null,
      errorMessage: null,
      attempt: 0
    });

    for (let attempt = 1; attempt <= config.webhookRetryCount; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.webhookTimeoutMs);
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(event),
          signal: controller.signal
        });
        clearTimeout(timeout);

        const responseText = await response.text();
        if (!response.ok) {
          throw new Error(`Webhook returned status ${response.status}`);
        }

        this.databaseService.webhookDeliveries.updateResult(delivery.id, {
          status: "success",
          httpStatus: response.status,
          responseBody: responseText,
          attempt
        });
        return;
      } catch (error) {
        this.databaseService.webhookDeliveries.updateResult(delivery.id, {
          status: attempt >= config.webhookRetryCount ? "failed" : "pending",
          errorMessage: error instanceof Error ? error.message : "Unknown webhook error",
          attempt
        });
        if (attempt >= config.webhookRetryCount) {
          logger.error({ error, eventType: event.type, sessionId: event.sessionId, url }, "Webhook dispatch failed");
          return;
        }
        await sleep(2 ** attempt * 250);
      }
    }
  }
}
