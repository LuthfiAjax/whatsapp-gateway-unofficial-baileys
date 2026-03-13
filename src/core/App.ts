import { config } from "../config/env";
import { WS_PATH } from "../config/constants";
import { AuthController } from "../controllers/AuthController";
import { ApiKeyController } from "../controllers/ApiKeyController";
import { BroadcastController } from "../controllers/BroadcastController";
import { GroupController } from "../controllers/GroupController";
import { MessageController } from "../controllers/MessageController";
import { SessionController } from "../controllers/SessionController";
import { TemplateController } from "../controllers/TemplateController";
import { WebhookController } from "../controllers/WebhookController";
import { DatabaseService } from "../database/DatabaseService";
import { AppRouter } from "../routes/AppRouter";
import { registerRoutes } from "../routes";
import { EventRouter } from "../services/EventRouter";
import { GroupService } from "../services/GroupService";
import { MessageQueue } from "../services/MessageQueue";
import { MessageService } from "../services/MessageService";
import { SessionManager } from "../session/SessionManager";
import type { RequestContext } from "../types/api";
import type { ClientSocketData } from "../websocket/WebSocketHub";
import { WebSocketHub } from "../websocket/WebSocketHub";
import { AppError } from "../utils/errors";
import { errorResponse, readJsonBody } from "../utils/http";
import { logger } from "../utils/logger";
import { WebhookDispatcher } from "../services/WebhookDispatcher";
import { AuthService } from "../services/AuthService";
import { TemplateService } from "../services/TemplateService";
import { BroadcastService } from "../services/BroadcastService";
import { WebhookService } from "../services/WebhookService";
import type { RouteHandler } from "../routes/AppRouter";

interface RateLimitRecord {
  count: number;
  startedAt: number;
}

export class App {
  private readonly databaseService = new DatabaseService(config.sqlitePath);
  private readonly webSocketHub = new WebSocketHub();
  private readonly webhookDispatcher = new WebhookDispatcher(this.databaseService);
  private readonly eventRouter = new EventRouter(this.webSocketHub, this.webhookDispatcher, this.databaseService);
  private readonly sessionManager = new SessionManager(this.databaseService, this.eventRouter);
  private readonly queue = new MessageQueue();
  private readonly templateService = new TemplateService(this.databaseService);
  private readonly messageService = new MessageService(this.databaseService, this.sessionManager, this.queue, this.eventRouter, this.templateService);
  private readonly broadcastService = new BroadcastService(this.databaseService, this.messageService, this.templateService);
  private readonly webhookService = new WebhookService(this.databaseService);
  private readonly groupService = new GroupService(this.sessionManager);
  private readonly authService = new AuthService(this.databaseService);
  private readonly router = new AppRouter((request, handler, params, path) => this.executeRoute(request, handler, params, path));
  private readonly rateLimit = new Map<string, RateLimitRecord>();

  public async bootstrap(): Promise<void> {
    this.databaseService.init();

    registerRoutes(this.router, this.databaseService, {
      authController: new AuthController(this.authService),
      apiKeyController: new ApiKeyController(this.databaseService),
      sessionController: new SessionController(this.sessionManager),
      messageController: new MessageController(this.messageService),
      groupController: new GroupController(this.groupService),
      templateController: new TemplateController(this.templateService),
      broadcastController: new BroadcastController(this.broadcastService),
      webhookController: new WebhookController(this.webhookService)
    });

    await this.sessionManager.restoreSessions();
  }

  public listen(): void {
    Bun.serve<ClientSocketData>({
      hostname: config.appHost,
      port: config.port,
      fetch: (request, server) => this.handleRequest(request, server),
      websocket: {
        open: (socket) => {
          socket.data = { sessionIds: new Set() };
        },
        message: (socket, rawMessage) => {
          try {
            const payload = JSON.parse(String(rawMessage)) as { type?: string; sessionId?: string };
            if (payload.type === "subscribe" && typeof payload.sessionId === "string") {
              this.webSocketHub.subscribe(socket, payload.sessionId);
              socket.send(JSON.stringify({ type: "subscribed", sessionId: payload.sessionId }));
              return;
            }
            socket.send(JSON.stringify({ type: "error", message: "Unsupported websocket message" }));
          } catch {
            socket.send(JSON.stringify({ type: "error", message: "Invalid websocket payload" }));
          }
        },
        close: (socket) => this.webSocketHub.unsubscribeAll(socket)
      }
    });

    process.stdout.write(`Server running on http://localhost:${config.port}\n`);
  }

  public async shutdown(): Promise<void> {
    await this.sessionManager.shutdown();
  }

  private async handleRequest(request: Request, server: Bun.Server<ClientSocketData>): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === WS_PATH) {
        const upgraded = server.upgrade(request, { data: { sessionIds: new Set<string>() } });
        if (upgraded) {
          return new Response(null);
        }
        throw new AppError(400, "WS_UPGRADE_FAILED", "WebSocket upgrade failed");
      }

      return await this.router.fetch(request);
    } catch (error) {
      const response = errorResponse(error);
      const requestId = crypto.randomUUID();
      this.logRequest({
        request,
        params: {},
        body: {},
        requestId,
        ipAddress: this.getClientIp(request)
      }, url.pathname, response.status, response.status === 401 ? "auth.failed" : "request.failed", error instanceof Error ? error.message : "Request failed");
      logger.error({ error, requestId, path: url.pathname }, "Request failed");
      return response;
    }
  }

  private async executeRoute(request: Request, handler: RouteHandler, params: Record<string, string>, path: string): Promise<Response> {
    const requestId = crypto.randomUUID();
    const ipAddress = this.getClientIp(request);
    const body = ["POST", "PATCH", "PUT", "DELETE"].includes(request.method.toUpperCase()) ? await readJsonBody(request) : {};
    const ctx: RequestContext = {
      request,
      params,
      body,
      requestId,
      ipAddress
    };

    try {
      this.enforceRateLimit(this.buildRateLimitKey(request, ipAddress));
      const response = await handler(ctx);
      this.logRequest(ctx, path, response.status, "request.success", "Request completed");
      return response;
    } catch (error) {
      const response = errorResponse(error);
      this.logRequest(ctx, path, response.status, response.status === 401 ? "auth.failed" : "request.failed", error instanceof Error ? error.message : "Request failed");
      logger.error({ error, requestId, path }, "Request failed");
      return response;
    }
  }

  private getClientIp(request: Request): string | null {
    return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  }

  private buildRateLimitKey(request: Request, ipAddress: string | null): string {
    const apiKey = request.headers.get("x-api-key");
    if (apiKey) {
      return `api-key:${apiKey}`;
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      return `bearer:${authHeader.slice(0, 24)}`;
    }
    return `ip:${ipAddress ?? "unknown"}`;
  }

  private enforceRateLimit(key: string): void {
    const now = Date.now();
    const current = this.rateLimit.get(key);

    if (!current || now - current.startedAt > config.rateLimitWindowMs) {
      this.rateLimit.set(key, { count: 1, startedAt: now });
      return;
    }

    if (current.count >= config.rateLimitMaxRequests) {
      throw new AppError(429, "RATE_LIMITED", "Too many requests");
    }

    current.count += 1;
  }

  private logRequest(ctx: RequestContext, path: string, statusCode: number, eventType: string, message: string): void {
    this.databaseService.logs.append({
      id: crypto.randomUUID(),
      userId: ctx.userId ?? null,
      apiKeyId: ctx.apiKeyRecord?.id ?? null,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      method: ctx.request.method,
      path,
      statusCode,
      eventType,
      message,
      metadata: JSON.stringify({
        authKind: ctx.authKind ?? null
      })
    });
  }
}
