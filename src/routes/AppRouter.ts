import type { RequestContext } from "../types/api";
import { AppError } from "../utils/errors";

export type RouteHandler = (ctx: RequestContext) => Promise<Response>;

interface RouteDefinition {
  method: string;
  pattern: string;
  handler: RouteHandler;
}

export class AppRouter {
  private readonly routes: RouteDefinition[] = [];

  public register(method: string, pattern: string, handler: RouteHandler): void {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      handler
    });
  }

  public match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) {
        continue;
      }

      const params = this.extractParams(route.pattern, pathname);
      if (params) {
        return {
          handler: route.handler,
          params
        };
      }
    }

    throw new AppError(404, "NOT_FOUND", "Route not found");
  }

  private extractParams(pattern: string, pathname: string): Record<string, string> | null {
    const routeParts = pattern.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);

    if (routeParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (const [index, routePart] of routeParts.entries()) {
      const pathPart = pathParts[index];
      if (!pathPart) {
        return null;
      }

      if (routePart.startsWith(":")) {
        params[routePart.slice(1)] = decodeURIComponent(pathPart);
        continue;
      }

      if (routePart !== pathPart) {
        return null;
      }
    }

    return params;
  }
}
