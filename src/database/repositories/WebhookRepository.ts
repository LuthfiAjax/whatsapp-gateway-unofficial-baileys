import { Database } from "bun:sqlite";
import type { MessageLogRecord, WebhookDeliveryRecord, WebhookRecord } from "../../types/models";

const webhookSelect = `
  SELECT
    id,
    user_id as userId,
    url,
    events,
    is_active as isActive,
    created_at as createdAt,
    updated_at as updatedAt
  FROM webhooks
`;

export class WebhookRepository {
  constructor(private readonly db: Database) {}

  public create(webhook: Omit<WebhookRecord, "createdAt" | "updatedAt">): WebhookRecord {
    const now = new Date().toISOString();
    this.db
      .query("INSERT INTO webhooks (id, user_id, url, events, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(webhook.id, webhook.userId, webhook.url, webhook.events, webhook.isActive, now, now);
    return this.findById(webhook.id, webhook.userId)!;
  }

  public findById(id: string, userId: string): WebhookRecord | null {
    return this.db.query(`${webhookSelect} WHERE id = ? AND user_id = ?`).get(id, userId) as WebhookRecord | null;
  }

  public listByUserId(userId: string): WebhookRecord[] {
    return this.db.query(`${webhookSelect} WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as WebhookRecord[];
  }

  public getActiveWebhooksForUser(userId: string): WebhookRecord[] {
    return this.db.query(`${webhookSelect} WHERE user_id = ? AND is_active = 1`).all(userId) as WebhookRecord[];
  }

  public delete(id: string, userId: string): boolean {
    const result = this.db.query("DELETE FROM webhooks WHERE id = ? AND user_id = ?").run(id, userId);
    return Number(result.changes) > 0;
  }
}

export class MessageLogRepository {
  constructor(private readonly db: Database) {}

  public append(log: Omit<MessageLogRecord, "createdAt">): void {
    this.db
      .query("INSERT INTO message_logs (id, session_id, user_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(log.id, log.sessionId, log.userId, log.eventType, log.payload, new Date().toISOString());
  }
}

export class WebhookDeliveryRepository {
  constructor(private readonly db: Database) {}

  public create(input: Omit<WebhookDeliveryRecord, "createdAt" | "updatedAt">): WebhookDeliveryRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO webhook_deliveries
        (id, webhook_id, user_id, session_id, event_type, target_url, payload, status, http_status, response_body, error_message, attempt, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.webhookId,
        input.userId,
        input.sessionId,
        input.eventType,
        input.targetUrl,
        input.payload,
        input.status,
        input.httpStatus,
        input.responseBody,
        input.errorMessage,
        input.attempt,
        now,
        now
      );
    return this.findById(input.id)!;
  }

  public findById(id: string): WebhookDeliveryRecord | null {
    return this.db
      .query(
        `SELECT id, webhook_id as webhookId, user_id as userId, session_id as sessionId, event_type as eventType, target_url as targetUrl, payload, status, http_status as httpStatus, response_body as responseBody, error_message as errorMessage, attempt, created_at as createdAt, updated_at as updatedAt
         FROM webhook_deliveries WHERE id = ?`
      )
      .get(id) as WebhookDeliveryRecord | null;
  }

  public updateResult(id: string, data: Partial<WebhookDeliveryRecord>): void {
    const current = this.findById(id);
    if (!current) {
      return;
    }
    this.db
      .query(
        "UPDATE webhook_deliveries SET status = ?, http_status = ?, response_body = ?, error_message = ?, attempt = ?, updated_at = ? WHERE id = ?"
      )
      .run(
        data.status ?? current.status,
        data.httpStatus ?? current.httpStatus,
        data.responseBody ?? current.responseBody,
        data.errorMessage ?? current.errorMessage,
        data.attempt ?? current.attempt,
        new Date().toISOString(),
        id
      );
  }
}
