import { BroadcastService } from "../services/BroadcastService";
import type { RequestContext } from "../types/api";
import { json } from "../utils/http";
import { requireParam } from "../utils/validation";

export class BroadcastController {
  public constructor(private readonly broadcastService: BroadcastService) {}

  public create = async (ctx: RequestContext): Promise<Response> => json(await this.broadcastService.create(ctx.userId!, ctx.body), 201);
  public list = async (ctx: RequestContext): Promise<Response> => json({ items: this.broadcastService.list(ctx.userId!) });
  public report = async (ctx: RequestContext): Promise<Response> => json(this.broadcastService.report(ctx.userId!, requireParam(ctx.params, "id")));
}
