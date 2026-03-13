import { SessionManager } from "../session/SessionManager";
import type { RequestContext } from "../types/api";
import { AppError } from "../utils/errors";
import { json } from "../utils/http";
import { asRecord, optionalNullableString, requireParam, requireString } from "../utils/validation";

export class SessionController {
  public constructor(private readonly sessionManager: SessionManager) {}

  public create = async (ctx: RequestContext): Promise<Response> => {
    const userId = ctx.userId!;
    const body = asRecord(ctx.body);
    const sessionName = requireString(body.sessionName, "sessionName");
    const phoneNumber = optionalNullableString(body.phoneNumber, "phoneNumber");
    const webhookUrl = optionalNullableString(body.webhookUrl, "webhookUrl");
    const sessionInput = {
      userId,
      sessionName
    } as const;
    const session = this.sessionManager.createSession(
      {
        ...sessionInput,
        ...(phoneNumber === undefined ? {} : { phoneNumber }),
        ...(webhookUrl === undefined ? {} : { webhookUrl })
      }
    );
    return json(session, 201);
  };

  public list = async (ctx: RequestContext): Promise<Response> => {
    return json({ items: this.sessionManager.listSessions(ctx.userId!) });
  };

  public detail = async (ctx: RequestContext): Promise<Response> => {
    return json(this.sessionManager.getSession(requireParam(ctx.params, "id"), ctx.userId!));
  };

  public connect = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    const method = requireString(body.method, "method") as "qr";
    if (method !== "qr") {
      throw new AppError(400, "VALIDATION_ERROR", "Only qr method is supported");
    }
    const phoneNumber = optionalNullableString(body.phoneNumber, "phoneNumber");
    const sessionId = requireParam(ctx.params, "id");
    const session = await this.sessionManager.connectSession(
      sessionId,
      ctx.userId!,
      phoneNumber === undefined ? { method } : { method, phoneNumber }
    );
    return json(session);
  };

  public status = async (ctx: RequestContext): Promise<Response> => {
    const session = this.sessionManager.getSession(requireParam(ctx.params, "id"), ctx.userId!);
    return json({
      sessionId: session.id,
      phoneNumber: session.phoneNumber,
      status: session.status
    });
  };

  public qr = async (ctx: RequestContext): Promise<Response> => {
    const sessionId = requireParam(ctx.params, "id");
    const session = this.sessionManager.getSession(sessionId, ctx.userId!);
    return json({
      sessionId,
      status: session.status,
      qrCodeBase64: this.sessionManager.getQrCode(sessionId, ctx.userId!)
    });
  };

  public info = async (ctx: RequestContext): Promise<Response> => {
    return json(this.sessionManager.getSessionInfo(requireParam(ctx.params, "id"), ctx.userId!));
  };

  public disconnect = async (ctx: RequestContext): Promise<Response> => {
    const session = await this.sessionManager.disconnectSession(requireParam(ctx.params, "id"), ctx.userId!);
    return json(session);
  };

  public updateWebhook = async (ctx: RequestContext): Promise<Response> => {
    return this.update(ctx);
  };

  public update = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    const allowedKeys = new Set(["webhookUrl"]);
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        throw new AppError(400, "VALIDATION_ERROR", "Only webhookUrl can be updated on this endpoint");
      }
    }

    const webhookUrl = optionalNullableString(body.webhookUrl, "webhookUrl") ?? null;
    const session = this.sessionManager.updateWebhook(requireParam(ctx.params, "id"), ctx.userId!, { webhookUrl });
    return json(session);
  };

  public updatePhoneNumber = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    const phoneNumber = requireString(body.phoneNumber, "phoneNumber");
    const session = await this.sessionManager.updatePhoneNumber(requireParam(ctx.params, "id"), ctx.userId!, { phoneNumber });
    return json(session);
  };

  public destroy = async (ctx: RequestContext): Promise<Response> => {
    await this.sessionManager.deleteSession(requireParam(ctx.params, "id"), ctx.userId!);
    return json({ deleted: true });
  };
}
