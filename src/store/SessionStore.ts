import type {
  SessionCreateInput,
  SessionPhoneUpdateInput,
  SessionRecord,
  SessionUpdateInput,
  SessionWebhookInput
} from "../types/session";
import { DatabaseService } from "../database/DatabaseService";

export class SessionStore {
  public constructor(private readonly databaseService: DatabaseService) {}

  public create(input: SessionCreateInput): SessionRecord {
    return this.databaseService.sessions.create({
      id: crypto.randomUUID(),
      userId: input.userId,
      sessionName: input.sessionName,
      phoneNumber: input.phoneNumber ?? null,
      status: "disconnected",
      webhookUrl: input.webhookUrl ?? null,
      deviceInfo: null,
      lastSeenAt: null
    });
  }

  public listByUser(userId: string): SessionRecord[] {
    return this.databaseService.sessions.listByUserId(userId);
  }

  public getById(sessionId: string, userId: string): SessionRecord | null {
    return this.databaseService.sessions.findById(sessionId, userId);
  }

  public updateWebhook(sessionId: string, userId: string, input: SessionWebhookInput): SessionRecord | null {
    return this.databaseService.sessions.update(sessionId, userId, { webhookUrl: input.webhookUrl });
  }

  public update(sessionId: string, userId: string, input: SessionUpdateInput): SessionRecord | null {
    return this.databaseService.sessions.update(sessionId, userId, input);
  }

  public updatePhoneNumber(sessionId: string, userId: string, input: SessionPhoneUpdateInput): SessionRecord | null {
    return this.databaseService.sessions.update(sessionId, userId, { phoneNumber: input.phoneNumber });
  }

  public delete(sessionId: string, userId: string): boolean {
    return this.databaseService.sessions.delete(sessionId, userId);
  }
}
