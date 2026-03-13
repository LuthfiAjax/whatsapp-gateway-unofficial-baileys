import type { DatabaseService } from "../database/DatabaseService";
import type { GatewayEvent, GatewayEventType } from "../types/events";
import type { SessionRecord } from "../types/session";
import { WebSocketHub } from "../websocket/WebSocketHub";
import { WebhookDispatcher } from "./WebhookDispatcher";

export class EventRouter {
  public constructor(
    private readonly webSocketHub: WebSocketHub,
    private readonly webhookDispatcher: WebhookDispatcher,
    private readonly databaseService: DatabaseService
  ) {}

  public emit<T>(session: SessionRecord, type: GatewayEventType, payload: T): void {
    const event: GatewayEvent<T> = {
      type,
      sessionId: session.id,
      userId: session.userId,
      occurredAt: new Date().toISOString(),
      payload
    };

    this.webSocketHub.emit(event);
    const targets = this.webhookDispatcher.getTargets(session.userId, session.webhookUrl, type);
    this.webhookDispatcher.dispatch(targets, event);
    this.databaseService.messageLogs.append({
      id: crypto.randomUUID(),
      sessionId: session.id,
      userId: session.userId,
      eventType: type,
      payload: JSON.stringify(payload)
    });
  }
}
