import { Database } from "bun:sqlite";
import type { AuthStateRecord, SessionRecord, SessionStatus } from "../../types/models";

const selectClause = `
  SELECT
    id,
    user_id as userId,
    session_name as sessionName,
    phone_number as phoneNumber,
    status,
    webhook_url as webhookUrl,
    device_info as deviceInfo,
    last_seen_at as lastSeenAt,
    created_at as createdAt,
    updated_at as updatedAt
  FROM sessions
`;

export class SessionRepository {
  constructor(private readonly db: Database) {}

  public create(session: Omit<SessionRecord, "createdAt" | "updatedAt">): SessionRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO sessions (id, user_id, session_name, phone_number, status, webhook_url, device_info, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.userId,
        session.sessionName,
        session.phoneNumber,
        session.status,
        session.webhookUrl,
        session.deviceInfo,
        session.lastSeenAt,
        now,
        now
      );

    return this.findById(session.id)!;
  }

  public listByUserId(userId: string): SessionRecord[] {
    return this.db.query(`${selectClause} WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as SessionRecord[];
  }

  public listRestorable(): SessionRecord[] {
    return this.db
      .query(`${selectClause} WHERE id IN (SELECT session_id FROM auth_states) ORDER BY created_at DESC`)
      .all() as SessionRecord[];
  }

  public findById(id: string, userId?: string): SessionRecord | null {
    const suffix = userId ? " WHERE id = ? AND user_id = ?" : " WHERE id = ?";
    return this.db.query(`${selectClause}${suffix}`).get(...(userId ? [id, userId] : [id])) as SessionRecord | null;
  }

  public updateStatus(id: string, status: SessionStatus): void {
    this.db.query("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  }

  public update(id: string, userId: string, data: Partial<SessionRecord>): SessionRecord | null {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.sessionName !== undefined) {
      fields.push("session_name = ?");
      values.push(data.sessionName);
    }
    if (data.webhookUrl !== undefined) {
      fields.push("webhook_url = ?");
      values.push(data.webhookUrl);
    }
    if (data.phoneNumber !== undefined) {
      fields.push("phone_number = ?");
      values.push(data.phoneNumber);
    }
    if (data.status !== undefined) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.deviceInfo !== undefined) {
      fields.push("device_info = ?");
      values.push(data.deviceInfo);
    }
    if (data.lastSeenAt !== undefined) {
      fields.push("last_seen_at = ?");
      values.push(data.lastSeenAt);
    }

    if (fields.length === 0) {
      return this.findById(id, userId);
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString(), id, userId);
    this.db.query(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(...values);
    return this.findById(id, userId);
  }

  public delete(id: string, userId: string): boolean {
    const result = this.db.query("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(id, userId);
    return Number(result.changes) > 0;
  }

  public getAuthState(sessionId: string): AuthStateRecord | null {
    return this.db
      .query("SELECT session_id as sessionId, creds, keys, updated_at as updatedAt FROM auth_states WHERE session_id = ?")
      .get(sessionId) as AuthStateRecord | null;
  }

  public saveAuthState(sessionId: string, creds: string, keys: string): void {
    const now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO auth_states (session_id, creds, keys, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET creds = excluded.creds, keys = excluded.keys, updated_at = excluded.updated_at"
      )
      .run(sessionId, creds, keys, now);
  }

  public clearAuthState(sessionId: string): void {
    this.db.query("DELETE FROM auth_states WHERE session_id = ?").run(sessionId);
  }
}
