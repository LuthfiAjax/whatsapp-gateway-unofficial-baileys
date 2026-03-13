import { Database } from "bun:sqlite";
import type { MessageRecord, MessageStatus } from "../../types/models";

const selectClause = `
  SELECT
    id,
    user_id as userId,
    session_id as sessionId,
    broadcast_id as broadcastId,
    recipient,
    message_type as messageType,
    payload,
    status,
    error_message as errorMessage,
    retry_count as retryCount,
    external_id as externalId,
    scheduled_at as scheduledAt,
    sent_at as sentAt,
    delivered_at as deliveredAt,
    read_at as readAt,
    created_at as createdAt,
    updated_at as updatedAt
  FROM messages
`;

export class MessageRepository {
  constructor(private readonly db: Database) {}

  public create(input: Omit<MessageRecord, "createdAt" | "updatedAt" | "retryCount" | "errorMessage" | "externalId" | "sentAt" | "deliveredAt" | "readAt"> & Partial<Pick<MessageRecord, "retryCount" | "errorMessage" | "externalId" | "sentAt" | "deliveredAt" | "readAt">>): MessageRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO messages
        (id, user_id, session_id, broadcast_id, recipient, message_type, payload, status, error_message, retry_count, external_id, scheduled_at, sent_at, delivered_at, read_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.userId,
        input.sessionId,
        input.broadcastId,
        input.recipient,
        input.messageType,
        input.payload,
        input.status,
        input.errorMessage ?? null,
        input.retryCount ?? 0,
        input.externalId ?? null,
        input.scheduledAt,
        input.sentAt ?? null,
        input.deliveredAt ?? null,
        input.readAt ?? null,
        now,
        now
      );
    return this.findById(input.id)!;
  }

  public findById(id: string): MessageRecord | null {
    return this.db.query(`${selectClause} WHERE id = ?`).get(id) as MessageRecord | null;
  }

  public listByBroadcastId(broadcastId: string): MessageRecord[] {
    return this.db.query(`${selectClause} WHERE broadcast_id = ? ORDER BY created_at ASC`).all(broadcastId) as MessageRecord[];
  }

  public updateStatus(id: string, status: MessageStatus, data: Partial<MessageRecord> = {}): MessageRecord | null {
    const current = this.findById(id);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    const sentAt = status === "sent" && !current.sentAt ? now : data.sentAt ?? current.sentAt;
    const deliveredAt = status === "delivered" && !current.deliveredAt ? now : data.deliveredAt ?? current.deliveredAt;
    const readAt = status === "read" && !current.readAt ? now : data.readAt ?? current.readAt;

    this.db
      .query(
        "UPDATE messages SET status = ?, error_message = ?, retry_count = ?, external_id = ?, sent_at = ?, delivered_at = ?, read_at = ?, updated_at = ? WHERE id = ?"
      )
      .run(
        status,
        data.errorMessage ?? current.errorMessage,
        data.retryCount ?? current.retryCount,
        data.externalId ?? current.externalId,
        sentAt,
        deliveredAt,
        readAt,
        now,
        id
      );

    return this.findById(id);
  }
}
