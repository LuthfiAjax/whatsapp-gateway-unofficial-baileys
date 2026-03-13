import { TemplateService } from "../services/TemplateService";
import type { RequestContext } from "../types/api";
import { json } from "../utils/http";
import { asRecord, requireArray, requireParam, requireString } from "../utils/validation";

export class TemplateController {
  public constructor(private readonly templateService: TemplateService) {}

  public list = async (ctx: RequestContext): Promise<Response> => json({ items: this.templateService.list(ctx.userId!) });

  public create = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    return json(
      this.templateService.create(ctx.userId!, {
        name: requireString(body.name, "name"),
        type: requireString(body.type, "type") as any,
        content: typeof body.content === "string" ? body.content : JSON.stringify(body.content ?? {}),
        variables: requireArray(body.variables ?? [], "variables").map((item) => String(item))
      }),
      201
    );
  };

  public update = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    const input: Partial<{ name: string; type: any; content: string; variables: string[] }> = {};
    if (typeof body.name === "string") input.name = body.name;
    if (typeof body.type === "string") input.type = body.type;
    if (body.content !== undefined) input.content = typeof body.content === "string" ? body.content : JSON.stringify(body.content);
    if (Array.isArray(body.variables)) input.variables = body.variables.map((item) => String(item));
    return json(
      this.templateService.update(ctx.userId!, requireParam(ctx.params, "id"), input)
    );
  };

  public destroy = async (ctx: RequestContext): Promise<Response> => {
    this.templateService.destroy(ctx.userId!, requireParam(ctx.params, "id"));
    return new Response(null, { status: 204 });
  };
}
