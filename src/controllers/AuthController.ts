import type { RequestContext } from "../types/api";
import { AppError } from "../utils/errors";
import { json } from "../utils/http";
import { asRecord, requireString } from "../utils/validation";
import { AuthService } from "../services/AuthService";

function getBearerToken(request: Request): string | undefined {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }
  return authHeader.slice(7).trim() || undefined;
}

export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  public register = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    return json(await this.authService.register(requireString(body.username, "username"), requireString(body.password, "password")), 201);
  };

  public login = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    return json(await this.authService.login(requireString(body.username, "username"), requireString(body.password, "password")));
  };

  public logout = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    await this.authService.logout(getBearerToken(ctx.request), typeof body.refreshToken === "string" ? body.refreshToken : undefined, ctx.userId!);
    return json({ loggedOut: true });
  };

  public refreshToken = async (ctx: RequestContext): Promise<Response> => {
    const body = asRecord(ctx.body);
    return json(await this.authService.refresh(requireString(body.refreshToken, "refreshToken")));
  };

  public me = async (ctx: RequestContext): Promise<Response> => {
    if (!ctx.user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
    return json({ user: { id: ctx.user.id, username: ctx.user.username } });
  };
}
