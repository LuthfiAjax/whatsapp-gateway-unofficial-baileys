import { Database } from "bun:sqlite";
import type { LogRecord } from "../../types/models";

export class LogRepository {
  constructor(private readonly db: Database) {}

  public append(input: Omit<LogRecord, "createdAt">): void {
    this.db
      .query(
        "INSERT INTO logs (id, user_id, api_key_id, request_id, ip_address, method, path, status_code, event_type, message, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        input.id,
        input.userId,
        input.apiKeyId,
        input.requestId,
        input.ipAddress,
        input.method,
        input.path,
        input.statusCode,
        input.eventType,
        input.message,
        input.metadata,
        new Date().toISOString()
      );
  }
}
