import type { DatabaseService } from "../database/DatabaseService";
import type { ApiKeyScope } from "../middlewares/auth";
import type { RequestContext } from "../types/api";
import { sha256 } from "../utils/crypto";
import { AppError } from "../utils/errors";
import { json } from "../utils/http";
import { asRecord, optionalString, requireArray, requireParam } from "../utils/validation";

const allowedScopes: ApiKeyScope[] = ["send_message", "manage_session", "read_status", "manage_template"];

function sanitizeRecord(record: { keyHash?: string; keyValue?: string | null }) {
  return {
    ...record,
    keyHash: undefined,
    keyValue: undefined
  };
}

export class ApiKeyController {
  public constructor(private readonly databaseService: DatabaseService) {}

  public list = async (ctx: RequestContext): Promise<Response> => {
    const keys = this.databaseService.apiKeys.listByUserId(ctx.userId!).map((key) => sanitizeRecord(key));
    return json({ items: keys });
  };

  public generate = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    const scopes = this.parseScopes(body.scopes ?? []);
    const rawKey = `sk_${crypto.randomUUID().replace(/-/g, "")}`;
    const record = this.databaseService.apiKeys.create({
      id: crypto.randomUUID(),
      userId: ctx.userId!,
      name: optionalString(body.name, "name") ?? "default",
      keyHash: await sha256(rawKey),
      keyValue: rawKey,
      keyHint: `${rawKey.slice(0, 5)}...${rawKey.slice(-4)}`,
      scopes: JSON.stringify(scopes),
      ipWhitelist: Array.isArray(body.ipWhitelist) ? JSON.stringify(body.ipWhitelist.map((entry) => String(entry))) : null,
      isActive: 1
    });

    return json(
      {
        apiKey: rawKey,
        record: sanitizeRecord(record)
      },
      201
    );
  };

  public view = async (ctx: RequestContext): Promise<Response> => {
    const record = this.requireOwnedKey(requireParam(ctx.params, "id"), ctx.userId!);
    if (!record.keyValue) {
      throw new AppError(404, "NOT_FOUND", "API key value is not available");
    }
    return json({
      apiKey: record.keyValue,
      record: sanitizeRecord(record)
    });
  };

  public regenerate = async (ctx: RequestContext): Promise<Response> => {
    const id = requireParam(ctx.params, "id");
    this.requireOwnedKey(id, ctx.userId!);

    const rawKey = `sk_${crypto.randomUUID().replace(/-/g, "")}`;
    const record = this.databaseService.apiKeys.replaceKey(id, ctx.userId!, {
      keyHash: await sha256(rawKey),
      keyValue: rawKey,
      keyHint: `${rawKey.slice(0, 5)}...${rawKey.slice(-4)}`
    });

    if (!record) {
      throw new AppError(404, "NOT_FOUND", "API key not found");
    }

    return json({
      apiKey: rawKey,
      record: sanitizeRecord(record)
    });
  };

  public revoke = async (ctx: RequestContext): Promise<Response> => {
    this.requireOwnedKey(requireParam(ctx.params, "id"), ctx.userId!);
    if (!this.databaseService.apiKeys.revoke(requireParam(ctx.params, "id"), ctx.userId!)) {
      throw new AppError(404, "NOT_FOUND", "API key not found");
    }
    return json({ revoked: true });
  };

  public destroy = async (ctx: RequestContext): Promise<Response> => {
    if (!this.databaseService.apiKeys.delete(this.requireOwnedKey(requireParam(ctx.params, "id"), ctx.userId!).id, ctx.userId!)) {
      throw new AppError(404, "NOT_FOUND", "API key not found");
    }
    return new Response(null, { status: 204 });
  };

  private parseScopes(input: unknown): string[] {
    const scopes = requireArray(input, "scopes").map((scope) => String(scope));
    for (const scope of scopes) {
      if (!allowedScopes.includes(scope as ApiKeyScope)) {
        throw new AppError(400, "VALIDATION_ERROR", `Unsupported scope: ${scope}`);
      }
    }
    return scopes;
  }

  private requireOwnedKey(id: string, userId: string) {
    const record = this.databaseService.apiKeys.findByIdAnyUser(id);
    if (!record) {
      throw new AppError(404, "NOT_FOUND", "API key not found");
    }
    if (record.userId !== userId) {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to access this API key");
    }
    return record;
  }
}
