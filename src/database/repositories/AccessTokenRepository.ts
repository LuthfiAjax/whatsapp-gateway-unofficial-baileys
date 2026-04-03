import { Database } from "bun:sqlite";
import type { AccessTokenRecord } from "../../types/models";

const selectClause = `
  SELECT
    id,
    user_id as userId,
    token_hash as tokenHash,
    expires_at as expiresAt,
    revoked_at as revokedAt,
    created_at as createdAt,
    updated_at as updatedAt
  FROM access_tokens
`;

export class AccessTokenRepository {
  constructor(private readonly db: Database) {}

  public create(input: Omit<AccessTokenRecord, "createdAt" | "updatedAt" | "revokedAt"> & Partial<Pick<AccessTokenRecord, "revokedAt">>): AccessTokenRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO access_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(input.id, input.userId, input.tokenHash, input.expiresAt, input.revokedAt ?? null, now, now);
    return this.findByHash(input.tokenHash)!;
  }

  public findByHash(tokenHash: string): AccessTokenRecord | null {
    return this.db.query(`${selectClause} WHERE token_hash = ?`).get(tokenHash) as AccessTokenRecord | null;
  }

  public revokeByHash(tokenHash: string): void {
    const now = new Date().toISOString();
    this.db.query("UPDATE access_tokens SET revoked_at = ?, updated_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(now, now, tokenHash);
  }

  public revokeAllByUserId(userId: string): void {
    const now = new Date().toISOString();
    this.db.query("UPDATE access_tokens SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(now, now, userId);
  }
}
