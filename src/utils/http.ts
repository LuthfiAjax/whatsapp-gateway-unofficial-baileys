import { config } from "../config/env";
import type { ApiErrorShape, ApiSuccess } from "../types/api";
import { AppError } from "./errors";

export function json<T>(data: T, status = 200): Response {
  const body: ApiSuccess<T> = {
    success: true,
    data
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

export const jsonResponse = json;

export function errorResponse(error: unknown): Response {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(
          500,
          "INTERNAL_SERVER_ERROR",
          config.nodeEnv === "production" ? "Internal server error" : error instanceof Error ? error.message : "Unknown error"
        );

  const body: ApiErrorShape = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message
    }
  };

  return new Response(JSON.stringify(body), {
    status: appError.status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function formDataToObject(formData: any): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (key in result) {
      const current = result[key];
      if (Array.isArray(current)) {
        current.push(value);
      } else {
        result[key] = [current, value];
      }
      continue;
    }

    result[key] = value;
  }

  return result;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    return formDataToObject(formData);
  }

  if (contentType.includes("text/plain") || contentType.includes("text/csv")) {
    return { raw: await request.text() };
  }

  return {};
}
