import type { DatabaseService } from "../database/DatabaseService";
import type { GatewayEventType } from "../types/events";
import type { WebhookRecord } from "../types/models";
import { AppError } from "../utils/errors";

export class WebhookService {
  public constructor(private readonly databaseService: DatabaseService) {}

  public list(userId: string): WebhookRecord[] {
    return this.databaseService.webhooks.listByUserId(userId);
  }

  public create(userId: string, input: { url: string; events: GatewayEventType[] }): WebhookRecord {
    return this.databaseService.webhooks.create({
      id: crypto.randomUUID(),
      userId,
      url: input.url,
      events: JSON.stringify(input.events),
      isActive: 1
    });
  }

  public delete(userId: string, id: string): void {
    if (!this.databaseService.webhooks.delete(id, userId)) {
      throw new AppError(404, "NOT_FOUND", "Webhook not found");
    }
  }
}
