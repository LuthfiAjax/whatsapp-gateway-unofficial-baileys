import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import schemaAssetPath from "./schema.sql";
import { UserRepository } from "./repositories/UserRepository";
import { ApiKeyRepository } from "./repositories/ApiKeyRepository";
import { SessionRepository } from "./repositories/SessionRepository";
import { TemplateRepository } from "./repositories/TemplateRepository";
import { BroadcastRepository } from "./repositories/BroadcastRepository";
import { MessageLogRepository, WebhookDeliveryRepository, WebhookRepository } from "./repositories/WebhookRepository";
import { RefreshTokenRepository } from "./repositories/RefreshTokenRepository";
import { MessageRepository } from "./repositories/MessageRepository";
import { LogRepository } from "./repositories/LogRepository";

const schemaSql = readFileSync(schemaAssetPath, "utf8");

export class DatabaseService {
  private readonly db: Database;

  public readonly users: UserRepository;
  public readonly refreshTokens: RefreshTokenRepository;
  public readonly apiKeys: ApiKeyRepository;
  public readonly sessions: SessionRepository;
  public readonly messages: MessageRepository;
  public readonly templates: TemplateRepository;
  public readonly broadcasts: BroadcastRepository;
  public readonly webhooks: WebhookRepository;
  public readonly webhookDeliveries: WebhookDeliveryRepository;
  public readonly messageLogs: MessageLogRepository;
  public readonly logs: LogRepository;

  public constructor(dbPath: string) {
    const normalizedPath = this.normalizePath(dbPath);
    this.ensureParentDirectory(normalizedPath);
    this.db = new Database(normalizedPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    this.users = new UserRepository(this.db);
    this.refreshTokens = new RefreshTokenRepository(this.db);
    this.apiKeys = new ApiKeyRepository(this.db);
    this.sessions = new SessionRepository(this.db);
    this.messages = new MessageRepository(this.db);
    this.templates = new TemplateRepository(this.db);
    this.broadcasts = new BroadcastRepository(this.db);
    this.webhooks = new WebhookRepository(this.db);
    this.webhookDeliveries = new WebhookDeliveryRepository(this.db);
    this.messageLogs = new MessageLogRepository(this.db);
    this.logs = new LogRepository(this.db);
  }

  private normalizePath(dbPath: string): string {
    if (dbPath === ":memory:") {
      return dbPath;
    }
    return isAbsolute(dbPath) ? dbPath : resolve(process.cwd(), dbPath);
  }

  private ensureParentDirectory(dbPath: string): void {
    if (dbPath === ":memory:") {
      return;
    }
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  public init(): void {
    this.migrate();
  }

  public migrate(): void {
    this.db.exec(schemaSql);
    this.ensureColumn("api_keys", "name", "TEXT NOT NULL DEFAULT 'default'");
    this.ensureColumn("api_keys", "ip_whitelist", "TEXT NULL");
    this.ensureColumn("api_keys", "usage_count", "INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("api_keys", "last_used_at", "TEXT NULL");
    this.ensureColumn("api_keys", "revoked_at", "TEXT NULL");
    this.ensureColumn("sessions", "device_info", "TEXT NULL");
    this.ensureColumn("sessions", "last_seen_at", "TEXT NULL");
    this.ensureColumn("broadcasts", "session_id", "TEXT NULL");
    this.ensureColumn("broadcasts", "delay_ms", "INTEGER NOT NULL DEFAULT 1000");
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const existing = this.db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (existing.some((entry) => entry.name === column)) {
      return;
    }
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
