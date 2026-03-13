import { WebhookService } from "../services/WebhookService";
import type { RequestContext } from "../types/api";
import { json } from "../utils/http";
import { asRecord, requireArray, requireParam, requireString } from "../utils/validation";

export class WebhookController {
  public constructor(private readonly webhookService: WebhookService) {}

  public list = async (ctx: RequestContext): Promise<Response> => json({ items: this.webhookService.list(ctx.userId!) });

  public create = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    return json(
      this.webhookService.create(ctx.userId!, {
        url: requireString(body.url, "url"),
        events: requireArray(body.events, "events").map((item) => String(item)) as any
      }),
      201
    );
  };

  public destroy = async (ctx: RequestContext): Promise<Response> => {
    this.webhookService.delete(ctx.userId!, requireParam(ctx.params, "id"));
    return new Response(null, { status: 204 });
  };
}
