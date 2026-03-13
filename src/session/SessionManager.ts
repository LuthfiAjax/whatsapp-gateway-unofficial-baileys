import { DatabaseService } from "../database/DatabaseService";
import { SessionStore } from "../store/SessionStore";
import type {
  SessionConnectInput,
  SessionConnectResult,
  SessionCreateInput,
  SessionPhoneUpdateInput,
  SessionRecord,
  SessionUpdateInput,
  SessionWebhookInput
} from "../types/session";
import { AppError } from "../utils/errors";
import { EventRouter } from "../services/EventRouter";
import { SessionInstance } from "./SessionInstance";

export class SessionManager {
  private readonly sessionStore: SessionStore;
  private readonly instances = new Map<string, SessionInstance>();

  public constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventRouter: EventRouter
  ) {
    this.sessionStore = new SessionStore(databaseService);
  }

  public async restoreSessions(): Promise<void> {
    const sessions = this.databaseService.sessions.listRestorable();
    for (const session of sessions) {
      const instance = this.getOrCreateInstance(session);
      await instance.connect({ method: "qr" });
    }
  }

  public createSession(input: SessionCreateInput): SessionRecord {
    return this.sessionStore.create(input);
  }

  public listSessions(userId: string): SessionRecord[] {
    return this.sessionStore.listByUser(userId);
  }

  public getSession(sessionId: string, userId: string): SessionRecord {
    const session = this.sessionStore.getById(sessionId, userId);
    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }
    return session;
  }

  public async connectSession(sessionId: string, userId: string, input: SessionConnectInput): Promise<SessionConnectResult> {
    let session = this.getSession(sessionId, userId);
    if (input.phoneNumber && input.phoneNumber !== session.phoneNumber) {
      if (session.status === "connected") {
        throw new AppError(409, "SESSION_CONNECTED", "Disconnect session before changing phone number");
      }
      const updated = this.sessionStore.updatePhoneNumber(sessionId, userId, { phoneNumber: input.phoneNumber });
      session = updated ?? session;
    }

    const instance = this.getOrCreateInstance(session);
    const result = await instance.connect(input);
    return {
      ...result,
      session: this.getSession(sessionId, userId)
    };
  }

  public async disconnectSession(sessionId: string, userId: string): Promise<SessionRecord> {
    const session = this.getSession(sessionId, userId);
    const instance = this.instances.get(session.id);
    await instance?.unlink();
    return this.getSession(sessionId, userId);
  }

  public async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = this.getSession(sessionId, userId);
    const instance = this.instances.get(session.id);
    await instance?.destroy();
    this.instances.delete(session.id);
    this.sessionStore.delete(session.id, userId);
  }

  public updateWebhook(sessionId: string, userId: string, input: SessionWebhookInput): SessionRecord {
    const session = this.sessionStore.updateWebhook(sessionId, userId, input);
    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    const instance = this.instances.get(session.id);
    instance?.updateSession(session);
    return session;
  }

  public updateSession(sessionId: string, userId: string, input: SessionUpdateInput): SessionRecord {
    const session = this.sessionStore.update(sessionId, userId, input);
    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    this.instances.get(session.id)?.updateSession(session);
    return session;
  }

  public async updatePhoneNumber(sessionId: string, userId: string, input: SessionPhoneUpdateInput): Promise<SessionRecord> {
    const current = this.getSession(sessionId, userId);
    const instance = this.instances.get(sessionId);

    if (current.status === "connected") {
      await instance?.unlink();
    } else {
      this.databaseService.sessions.clearAuthState(sessionId);
      await instance?.stopRuntime();
    }

    const session = this.sessionStore.updatePhoneNumber(sessionId, userId, input);
    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
    }

    this.instances.get(session.id)?.updateSession(session);
    return session;
  }

  public getInstance(sessionId: string, userId: string): SessionInstance {
    const session = this.getSession(sessionId, userId);
    const instance = this.instances.get(session.id);
    if (!instance) {
      throw new AppError(409, "SESSION_NOT_CONNECTED", "Session runtime is not active");
    }
    instance.updateSession(session);
    return instance;
  }

  public async shutdown(): Promise<void> {
    for (const instance of this.instances.values()) {
      await instance.stopRuntime();
    }
  }

  private getOrCreateInstance(session: SessionRecord): SessionInstance {
    const existing = this.instances.get(session.id);
    if (existing) {
      existing.updateSession(session);
      return existing;
    }

    const instance = new SessionInstance(session, this.databaseService, this.eventRouter);
    this.instances.set(session.id, instance);
    return instance;
  }

  public getQrCode(sessionId: string, userId: string): string | null {
    const session = this.getSession(sessionId, userId);
    return this.instances.get(session.id)?.getQrCode() ?? null;
  }

  public getSessionInfo(sessionId: string, userId: string): Record<string, unknown> {
    const session = this.getSession(sessionId, userId);
    return {
      id: session.id,
      sessionName: session.sessionName,
      phoneNumber: session.phoneNumber,
      status: session.status,
      deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
      lastSeenAt: session.lastSeenAt,
      isRuntimeActive: this.instances.has(session.id)
    };
  }
}
