import { Database } from "bun:sqlite";
import type { BroadcastRecord, BroadcastRecipientRecord, BroadcastStatus } from "../../types/models";

const selectClause = `
  SELECT
    id,
    user_id as userId,
    session_id as sessionId,
    name,
    template_id as templateId,
    message_content as messageContent,
    delay_ms as delayMs,
    status,
    created_at as createdAt,
    updated_at as updatedAt
  FROM broadcasts
`;

export class BroadcastRepository {
  constructor(private readonly db: Database) {}

  public create(broadcast: Omit<BroadcastRecord, "createdAt" | "updatedAt">): BroadcastRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO broadcasts (id, user_id, session_id, name, template_id, message_content, delay_ms, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        broadcast.id,
        broadcast.userId,
        broadcast.sessionId,
        broadcast.name,
        broadcast.templateId,
        broadcast.messageContent,
        broadcast.delayMs,
        broadcast.status,
        now,
        now
      );

    return this.findById(broadcast.id, broadcast.userId)!;
  }

  public findById(id: string, userId: string): BroadcastRecord | null {
    return this.db.query(`${selectClause} WHERE id = ? AND user_id = ?`).get(id, userId) as BroadcastRecord | null;
  }

  public findByRecipientId(recipientId: string): BroadcastRecord | null {
    return this.db
      .query(
        `${selectClause} WHERE id = (SELECT broadcast_id FROM broadcast_recipients WHERE id = ?)`
      )
      .get(recipientId) as BroadcastRecord | null;
  }

  public listByUserId(userId: string): BroadcastRecord[] {
    return this.db.query(`${selectClause} WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as BroadcastRecord[];
  }

  public updateStatus(id: string, status: BroadcastStatus): void {
    this.db.query("UPDATE broadcasts SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  }

  public createRecipients(recipients: Omit<BroadcastRecipientRecord, "createdAt" | "updatedAt">[]): void {
    const now = new Date().toISOString();
    const stmt = this.db.query(
      "INSERT INTO broadcast_recipients (id, broadcast_id, phone_number, variables, status, error_message, sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    this.db.transaction(() => {
      for (const recipient of recipients) {
        stmt.run(
          recipient.id,
          recipient.broadcastId,
          recipient.phoneNumber,
          recipient.variables,
          recipient.status,
          recipient.errorMessage,
          recipient.sentAt,
          now,
          now
        );
      }
    })();
  }

  public listRecipients(broadcastId: string): BroadcastRecipientRecord[] {
    return this.db
      .query(
        `SELECT id, broadcast_id as broadcastId, phone_number as phoneNumber, variables, status, error_message as errorMessage, sent_at as sentAt, created_at as createdAt, updated_at as updatedAt
         FROM broadcast_recipients WHERE broadcast_id = ? ORDER BY created_at ASC`
      )
      .all(broadcastId) as BroadcastRecipientRecord[];
  }

  public updateRecipientStatus(id: string, status: string, errorMessage?: string): void {
    const now = new Date().toISOString();
    this.db
      .query("UPDATE broadcast_recipients SET status = ?, error_message = ?, sent_at = ?, updated_at = ? WHERE id = ?")
      .run(status, errorMessage ?? null, status === "sent" ? now : null, now, id);
  }
}
