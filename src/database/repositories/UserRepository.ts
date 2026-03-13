import { Database } from "bun:sqlite";
import type { UserRecord } from "../../types/models";

export class UserRepository {
  constructor(private readonly db: Database) {}

  public create(user: Omit<UserRecord, "createdAt" | "updatedAt">): UserRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(user.id, user.username, user.passwordHash, now, now);

    return this.findById(user.id)!;
  }

  public findById(id: string): UserRecord | null {
    return this.db
      .query(
        "SELECT id, username, password_hash as passwordHash, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?"
      )
      .get(id) as UserRecord | null;
  }

  public findByUsername(username: string): UserRecord | null {
    return this.db
      .query(
        "SELECT id, username, password_hash as passwordHash, created_at as createdAt, updated_at as updatedAt FROM users WHERE username = ?"
      )
      .get(username) as UserRecord | null;
  }
}
