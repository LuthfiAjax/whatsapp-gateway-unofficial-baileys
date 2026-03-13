import { config } from "../config/env";
import type { TemplateRecord, TemplateType } from "../types/models";
import { AppError } from "../utils/errors";
import { asRecord, parseJsonArray, parseJsonObject } from "../utils/validation";

export interface PreparedMessagePayload {
  to: string;
  type: TemplateType;
  payload: Record<string, unknown>;
}

export function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  let normalized = digits.startsWith("+") ? digits.slice(1) : digits;
  if (normalized.startsWith("0")) {
    normalized = `${config.defaultCountryCode}${normalized.slice(1)}`;
  }
  if (!/^\d{8,15}$/.test(normalized)) {
    throw new AppError(400, "VALIDATION_ERROR", "to must be a valid international phone number");
  }
  return `${normalized}@s.whatsapp.net`;
}

export function toPublicPhoneNumber(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "");
}

export function renderVariables(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(variables[key] ?? ""));
}

export function renderTemplate(template: TemplateRecord, runtimeVariables: Record<string, unknown>): PreparedMessagePayload {
  const requiredVariables = parseJsonArray(template.variables);
  for (const variable of requiredVariables) {
    if (!(variable in runtimeVariables)) {
      throw new AppError(400, "VALIDATION_ERROR", `Missing template variable: ${variable}`);
    }
  }

  if (template.type === "text") {
    return {
      to: "",
      type: "text",
      payload: { text: renderVariables(template.content, runtimeVariables) }
    };
  }

  const content = parseJsonObject<Record<string, unknown>>(template.content, {});
  const rendered = JSON.parse(
    JSON.stringify(content, (_, value) => (typeof value === "string" ? renderVariables(value, runtimeVariables) : value))
  ) as Record<string, unknown>;

  return {
    to: "",
    type: template.type,
    payload: rendered
  };
}

export function ensureBodyObject(body: unknown): Record<string, unknown> {
  return asRecord(body);
}
