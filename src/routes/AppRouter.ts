import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppError } from "../utils/errors";
import { errorResponse } from "../utils/http";
import type { RequestContext } from "../types/api";
import { logger } from "../utils/logger";

export type RouteHandler = (ctx: RequestContext) => Promise<Response>;
type RouteExecutor = (request: Request, handler: RouteHandler, params: Record<string, string>, path: string) => Promise<Response>;

export class AppRouter {
  private readonly app = new Hono();

  public constructor(private readonly executeRoute: RouteExecutor) {
    this.app.use(
      "*",
      cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        allowHeaders: ["*"],
        credentials: false
      })
    );

    this.app.use("*", async (ctx, next) => {
      const startedAt = Date.now();
      await next();
      logger.info(
        {
          method: ctx.req.method,
          path: ctx.req.path,
          statusCode: ctx.res.status,
          durationMs: Date.now() - startedAt
        },
        "Request completed"
      );
    });

    this.app.get("/", (ctx) => {
      return ctx.json({
        status: "ok",
        service: "wa-gateway",
        uptime: process.uptime()
      });
    });

    this.app.get("/health", (ctx) => {
      return ctx.json({ ok: true });
    });

    this.app.notFound(() => errorResponse(new AppError(404, "NOT_FOUND", "Route not found")));
    this.app.onError((error, ctx) => {
      logger.error({ error, method: ctx.req.method, path: ctx.req.path }, "Request failed");
      return errorResponse(error);
    });
  }

  public register(method: string, pattern: string, handler: RouteHandler): void {
    this.app.on(method.toUpperCase() as any, pattern, (ctx) => {
      return this.executeRoute(ctx.req.raw, handler, ctx.req.param(), ctx.req.path);
    });
  }

  public fetch(request: Request): Promise<Response> {
    return Promise.resolve(this.app.fetch(request));
  }
}
