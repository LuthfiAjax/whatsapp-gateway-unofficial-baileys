import { AppError } from "./errors";

export function asRecord(value: unknown, message = "Request body must be an object"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "VALIDATION_ERROR", message);
  }
  return value as Record<string, unknown>;
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a non-empty string`);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a string`);
  }
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

export function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a string or null`);
  }
  return value.trim();
}

export function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be an array`);
  }
  return value;
}

export function requireObjectArray(value: unknown, field: string): Record<string, unknown>[] {
  return requireArray(value, field).map((item, index) => asRecord(item, `${field}[${index}] must be an object`));
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a boolean`);
  }
  return value;
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireBoolean(value, field);
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a valid number`);
  }
  return value;
}

export function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireNumber(value, field);
}

export function requireInteger(value: unknown, field: string): number {
  const parsed = requireNumber(value, field);
  if (!Number.isInteger(parsed)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be an integer`);
  }
  return parsed;
}

export function requireParam(params: Record<string, string>, key: string): string {
  const value = params[key];
  if (!value) {
    throw new AppError(400, "VALIDATION_ERROR", `Missing route param: ${key}`);
  }
  return value;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T extends object>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
