import { Database } from "bun:sqlite";
import type { TemplateRecord } from "../../types/models";

export class TemplateRepository {
  constructor(private readonly db: Database) {}

  public create(template: Omit<TemplateRecord, "createdAt" | "updatedAt">): TemplateRecord {
    const now = new Date().toISOString();
    this.db
      .query(
        "INSERT INTO templates (id, user_id, name, type, content, variables, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(template.id, template.userId, template.name, template.type, template.content, template.variables, now, now);

    return this.findById(template.id, template.userId)!;
  }

  public findById(id: string, userId: string): TemplateRecord | null {
    return this.db
      .query(
        "SELECT id, user_id as userId, name, type, content, variables, created_at as createdAt, updated_at as updatedAt FROM templates WHERE id = ? AND user_id = ?"
      )
      .get(id, userId) as TemplateRecord | null;
  }

  public listByUserId(userId: string): TemplateRecord[] {
    return this.db
      .query(
        "SELECT id, user_id as userId, name, type, content, variables, created_at as createdAt, updated_at as updatedAt FROM templates WHERE user_id = ? ORDER BY created_at DESC"
      )
      .all(userId) as TemplateRecord[];
  }

  public update(id: string, userId: string, data: Partial<TemplateRecord>): TemplateRecord | null {
    const current = this.findById(id, userId);
    if (!current) return null;

    this.db
      .query(
        "UPDATE templates SET name = ?, type = ?, content = ?, variables = ?, updated_at = ? WHERE id = ? AND user_id = ?"
      )
      .run(
        data.name ?? current.name,
        data.type ?? current.type,
        data.content ?? current.content,
        data.variables ?? current.variables,
        new Date().toISOString(),
        id,
        userId
      );

    return this.findById(id, userId);
  }

  public delete(id: string, userId: string): boolean {
    const result = this.db.query("DELETE FROM templates WHERE id = ? AND user_id = ?").run(id, userId);
    return Number(result.changes) > 0;
  }
}
