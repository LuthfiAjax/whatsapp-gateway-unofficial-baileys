import { Database } from "bun:sqlite";
import type { ApiKeyRecord } from "../../types/models";

const selectClause = `
  SELECT
    id,
    user_id as userId,
    name,
    key_hash as keyHash,
    key_value as keyValue,
    key_hint as keyHint,
    scopes,
    ip_whitelist as ipWhitelist,
    usage_count as usageCount,
    last_used_at as lastUsedAt,
    is_active as isActive,
    revoked_at as revokedAt,
    created_at as createdAt,
    updated_at as updatedAt
  FROM api_keys
`;

export class ApiKeyRepository {
  constructor(private readonly db: Database) {}

  public create(input: Omit<ApiKeyRecord, "createdAt" | "updatedAt" | "usageCount" | "lastUsedAt" | "revokedAt"> & Partial<Pick<ApiKeyRecord, "usageCount" | "lastUsedAt" | "revokedAt">>): ApiKeyRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO api_keys (id, user_id, name, key_hash, key_value, key_hint, scopes, ip_whitelist, usage_count, last_used_at, is_active, revoked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.userId,
        input.name,
        input.keyHash,
        input.keyValue ?? null,
        input.keyHint,
        input.scopes,
        input.ipWhitelist ?? null,
        input.usageCount ?? 0,
        input.lastUsedAt ?? null,
        input.isActive,
        input.revokedAt ?? null,
        now,
        now
      );

    return this.findById(input.id, input.userId)!;
  }

  public findById(id: string, userId: string): ApiKeyRecord | null {
    return this.db.query(`${selectClause} WHERE id = ? AND user_id = ?`).get(id, userId) as ApiKeyRecord | null;
  }

  public findByIdAnyUser(id: string): ApiKeyRecord | null {
    return this.db.query(`${selectClause} WHERE id = ?`).get(id) as ApiKeyRecord | null;
  }

  public findByHash(keyHash: string): ApiKeyRecord | null {
    return this.db.query(`${selectClause} WHERE key_hash = ?`).get(keyHash) as ApiKeyRecord | null;
  }

  public listByUserId(userId: string): ApiKeyRecord[] {
    return this.db.query(`${selectClause} WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as ApiKeyRecord[];
  }

  public touchUsage(id: string): void {
    const now = new Date().toISOString();
    this.db
      .query("UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, id);
  }

  public revoke(id: string, userId: string): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .query("UPDATE api_keys SET is_active = 0, revoked_at = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(now, now, id, userId);
    return Number(result.changes) > 0;
  }

  public delete(id: string, userId: string): boolean {
    const result = this.db.query("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(id, userId);
    return Number(result.changes) > 0;
  }

  public replaceKey(id: string, userId: string, input: Pick<ApiKeyRecord, "keyHash" | "keyValue" | "keyHint">): ApiKeyRecord | null {
    const now = new Date().toISOString();
    const update = this.db.transaction(() => {
      const result = this.db
        .query("UPDATE api_keys SET key_hash = ?, key_value = ?, key_hint = ?, is_active = 1, revoked_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?")
        .run(input.keyHash, input.keyValue ?? null, input.keyHint, now, id, userId);
      if (Number(result.changes) === 0) {
        return null;
      }
      return this.findById(id, userId);
    });
    return update() ?? null;
  }
}
