import jwt from "jsonwebtoken";
import { config } from "../config/env";
import type { DatabaseService } from "../database/DatabaseService";
import type { RouteHandler } from "../routes/AppRouter";
import type { RequestContext } from "../types/api";
import { AppError } from "../utils/errors";
import { parseJsonArray } from "../utils/validation";
import { sha256 } from "../utils/crypto";

export type ApiKeyScope = "send_message" | "manage_session" | "read_status" | "manage_template";

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

function getClientIp(request: Request): string | null {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function authenticateJwt(databaseService: DatabaseService, ctx: RequestContext): Promise<void> {
  const token = getBearerToken(ctx.request);
  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; type?: string };
    if (decoded.type && decoded.type !== "access") {
      throw new AppError(401, "UNAUTHORIZED", "Invalid token type");
    }

    const tokenHash = await sha256(token);
    const tokenRecord = databaseService.accessTokens.findByHash(tokenHash);
    if (!tokenRecord || tokenRecord.revokedAt || Date.parse(tokenRecord.expiresAt) <= Date.now()) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
    }

    const user = databaseService.users.findById(decoded.sub);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found");
    }

    ctx.userId = user.id;
    ctx.user = user;
    ctx.authKind = "jwt";
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
}

async function authenticateApiKey(databaseService: DatabaseService, ctx: RequestContext): Promise<void> {
  const rawKey = ctx.request.headers.get("x-api-key");
  if (!rawKey) {
    throw new AppError(401, "UNAUTHORIZED", "Missing x-api-key header");
  }

  const hashedKey = await sha256(rawKey);
  const keyRecord = databaseService.apiKeys.findByHash(hashedKey);
  if (!keyRecord || !keyRecord.isActive) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid API key");
  }

  const allowedIps = parseJsonArray(keyRecord.ipWhitelist);
  const requestIp = ctx.ipAddress ?? getClientIp(ctx.request);
  if (allowedIps.length > 0 && requestIp && !allowedIps.includes(requestIp)) {
    throw new AppError(403, "FORBIDDEN", "IP address is not allowed for this API key");
  }

  const user = databaseService.users.findById(keyRecord.userId);
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "User not found");
  }

  databaseService.apiKeys.touchUsage(keyRecord.id);
  ctx.userId = user.id;
  ctx.user = user;
  ctx.apiKey = rawKey;
  ctx.apiKeyRecord = databaseService.apiKeys.findById(keyRecord.id, keyRecord.userId);
  ctx.authKind = "api_key";
}

async function authenticateEither(databaseService: DatabaseService, ctx: RequestContext): Promise<void> {
  if (ctx.request.headers.get("x-api-key")) {
    await authenticateApiKey(databaseService, ctx);
    return;
  }
  await authenticateJwt(databaseService, ctx);
}

function hasScope(ctx: RequestContext, scope: ApiKeyScope): boolean {
  if (ctx.authKind !== "api_key") {
    return true;
  }
  const scopes = parseJsonArray(ctx.apiKeyRecord?.scopes);
  return scopes.includes("*") || scopes.includes(scope);
}

function wrapAuth(databaseService: DatabaseService, authenticator: (databaseService: DatabaseService, ctx: RequestContext) => Promise<void>, requiredScopes?: ApiKeyScope[]) {
  return (handler: RouteHandler): RouteHandler => {
    return async (ctx: RequestContext): Promise<Response> => {
      await authenticator(databaseService, ctx);
      for (const scope of requiredScopes ?? []) {
        if (!hasScope(ctx, scope)) {
          throw new AppError(403, "FORBIDDEN", `API key is missing required scope: ${scope}`);
        }
      }
      return handler(ctx);
    };
  };
}

export function requireAuth(databaseService: DatabaseService, requiredScopes?: ApiKeyScope[]) {
  return wrapAuth(databaseService, authenticateEither, requiredScopes);
}

export function requireJwtAuth(databaseService: DatabaseService) {
  return wrapAuth(databaseService, authenticateJwt);
}
