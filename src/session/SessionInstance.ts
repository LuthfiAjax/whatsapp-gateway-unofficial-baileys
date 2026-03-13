import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidStatusBroadcast,
  type ConnectionState,
  type WAMessage,
  type WASocket
} from "baileys";
import QRCode from "qrcode";
import { DatabaseService } from "../database/DatabaseService";
import type { SessionConnectInput, SessionConnectResult, SessionRecord } from "../types/session";
import { logger } from "../utils/logger";
import { EventRouter } from "../services/EventRouter";
import { SQLiteAuthState } from "./SQLiteAuthState";

export class SessionInstance {
  private socket: WASocket | null = null;
  private authState: SQLiteAuthState | null = null;
  private destroyed = false;
  private desiredConnection: SessionConnectInput = { method: "qr" };
  private qrCodeBase64: string | null = null;
  private connectWaiters = new Set<(result: SessionConnectResult) => void>();

  public constructor(
    private session: SessionRecord,
    private readonly databaseService: DatabaseService,
    private readonly eventRouter: EventRouter
  ) {}

  public getSession(): SessionRecord {
    return this.session;
  }

  public updateSession(record: SessionRecord): void {
    this.session = record;
  }

  public getQrCode(): string | null {
    return this.qrCodeBase64;
  }

  public async connect(input: SessionConnectInput): Promise<SessionConnectResult> {
    if (this.session.status === "connected" && this.socket) {
      return {
        session: this.session,
        state: "connected",
        qrCodeBase64: null
      };
    }

    if (this.session.status === "connecting" && this.socket) {
      if (this.qrCodeBase64) {
        return {
          session: this.session,
          state: "awaiting_qr",
          qrCodeBase64: this.qrCodeBase64
        };
      }

      return await this.waitForConnectResult();
    }

    this.desiredConnection = input;
    this.destroyed = false;
    this.qrCodeBase64 = null;
    this.databaseService.sessions.updateStatus(this.session.id, "connecting");
    this.session = this.databaseService.sessions.findById(this.session.id)!;
    this.authState = new SQLiteAuthState(this.session.id, this.databaseService);

    if (this.socket) {
      this.socket.end(new Error("Reconnect requested"));
      this.socket = null;
    }

    const { version } = await fetchLatestBaileysVersion();
    this.socket = makeWASocket({
      version,
      auth: this.authState.state,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      defaultQueryTimeoutMs: 60_000
    });

    this.bindSocketEvents(this.socket);
    return await this.waitForConnectResult();
  }

  public async stopRuntime(): Promise<void> {
    this.destroyed = true;
    this.socket?.end(new Error("Manual disconnect"));
    this.socket = null;
    this.resolveConnectWaiters({
      session: this.session,
      state: "awaiting_qr",
      qrCodeBase64: this.qrCodeBase64
    });
  }

  public async unlink(): Promise<void> {
    await this.stopRuntime();
    this.authState?.clear();
    this.authState = null;
    this.qrCodeBase64 = null;
    this.databaseService.sessions.updateStatus(this.session.id, "disconnected");
    this.session = this.databaseService.sessions.findById(this.session.id)!;
  }

  public async destroy(): Promise<void> {
    await this.unlink();
  }

  public isConnected(): boolean {
    return this.session.status === "connected";
  }

  public requireSocket(): WASocket {
    if (!this.socket) {
      throw new Error(`Session ${this.session.id} is not connected`);
    }
    return this.socket;
  }

  private bindSocketEvents(socket: WASocket): void {
    socket.ev.on("creds.update", () => {
      this.authState?.saveCreds();
    });

    socket.ev.on("connection.update", async (update) => {
      await this.handleConnectionUpdate(update);
    });

    socket.ev.on("messages.upsert", ({ messages, type }) => {
      for (const message of messages) {
        this.handleMessage(message, type);
      }
    });

    socket.ev.on("group-participants.update", (payload) => {
      this.eventRouter.emit(this.session, "group_update", payload);
    });

    socket.ev.on("presence.update", (payload) => {
      this.eventRouter.emit(this.session, "presence_update", payload);
    });

    socket.ev.on("call", (payload) => {
      this.eventRouter.emit(this.session, "call_event", payload);
    });
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    if (update.qr) {
      this.qrCodeBase64 = await QRCode.toDataURL(update.qr);
      this.eventRouter.emit(this.session, "qr", { qrCodeBase64: this.qrCodeBase64 });
      this.resolveConnectWaiters({
        session: this.session,
        state: "awaiting_qr",
        qrCodeBase64: this.qrCodeBase64
      });
    }

    if (update.connection === "open") {
      this.databaseService.sessions.updateStatus(this.session.id, "connected");
      this.session = this.databaseService.sessions.update(this.session.id, this.session.userId, {
        deviceInfo: JSON.stringify({ connectedAt: new Date().toISOString() }),
        lastSeenAt: new Date().toISOString()
      }) ?? this.databaseService.sessions.findById(this.session.id)!;
      this.qrCodeBase64 = null;
      this.eventRouter.emit(this.session, "session.connected", { status: "connected" });
      this.resolveConnectWaiters({
        session: this.session,
        state: "connected",
        qrCodeBase64: null
      });
    }

    this.eventRouter.emit(this.session, "connection_update", update);

    if (update.connection === "close") {
      const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.destroyed;

      this.databaseService.sessions.updateStatus(this.session.id, "disconnected");
      this.session = this.databaseService.sessions.update(this.session.id, this.session.userId, {
        lastSeenAt: new Date().toISOString()
      }) ?? this.databaseService.sessions.findById(this.session.id)!;
      this.eventRouter.emit(this.session, "session.disconnected", { statusCode });

      if (shouldReconnect) {
        logger.warn({ sessionId: this.session.id, statusCode }, "Reconnecting session");
        await this.connect(this.desiredConnection);
      } else {
        this.resolveConnectWaiters({
          session: this.session,
          state: "awaiting_qr",
          qrCodeBase64: this.qrCodeBase64
        });
      }
    }
  }

  private handleMessage(message: WAMessage, upsertType: string): void {
    if (!message.key.remoteJid || isJidStatusBroadcast(message.key.remoteJid)) {
      return;
    }

    const eventType = message.key.fromMe ? "message.sent" : "message.received";
    this.eventRouter.emit(this.session, eventType, {
      upsertType,
      message
    });
  }

  private waitForConnectResult(timeoutMs = 15_000): Promise<SessionConnectResult> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.connectWaiters.delete(onResolve);
        resolve({
          session: this.session,
          state: this.session.status === "connected" ? "connected" : "awaiting_qr",
          qrCodeBase64: this.qrCodeBase64
        });
      }, timeoutMs);

      const onResolve = (result: SessionConnectResult) => {
        clearTimeout(timer);
        this.connectWaiters.delete(onResolve);
        resolve(result);
      };

      this.connectWaiters.add(onResolve);
    });
  }

  private resolveConnectWaiters(result: SessionConnectResult): void {
    for (const resolve of this.connectWaiters) {
      resolve(result);
    }
    this.connectWaiters.clear();
  }
}
