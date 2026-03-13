import { GroupService } from "../services/GroupService";
import type { RequestContext } from "../types/api";
import { json } from "../utils/http";
import { requireParam } from "../utils/validation";

export class GroupController {
  public constructor(private readonly groupService: GroupService) {}

  public list = async (ctx: RequestContext): Promise<Response> => {
    return json(await this.groupService.listGroups(ctx.userId!, requireParam(ctx.params, "id")));
  };

  public listMembers = async (ctx: RequestContext): Promise<Response> => {
    return json(await this.groupService.listMembers(ctx.userId!, requireParam(ctx.params, "id"), requireParam(ctx.params, "groupId")));
  };
}
