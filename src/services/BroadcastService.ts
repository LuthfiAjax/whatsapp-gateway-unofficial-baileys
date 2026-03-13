import type { DatabaseService } from "../database/DatabaseService";
import { AppError } from "../utils/errors";
import { asRecord, optionalNumber, optionalString, requireArray, requireString } from "../utils/validation";
import { MessageService } from "./MessageService";
import { TemplateService } from "./TemplateService";
import { normalizePhoneNumber, renderTemplate } from "./message-helpers";

export class BroadcastService {
  public constructor(
    private readonly databaseService: DatabaseService,
    private readonly messageService: MessageService,
    private readonly templateService: TemplateService
  ) {}

  public list(userId: string) {
    return this.databaseService.broadcasts.listByUserId(userId);
  }

  public async create(userId: string, body: unknown) {
    const payload = asRecord(body);
    const sessionId = requireString(payload.sessionId, "sessionId");
    const delayMs = optionalNumber(payload.delayMs, "delayMs") ?? 1000;
    const recipients = await this.extractRecipients(payload);
    if (recipients.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Broadcast recipients are required");
    }

    const broadcast = this.databaseService.broadcasts.create({
      id: crypto.randomUUID(),
      userId,
      sessionId,
      name: optionalString(payload.name, "name") ?? `broadcast-${Date.now()}`,
      templateId: optionalString(payload.templateId, "templateId") ?? null,
      messageContent: optionalString(payload.text, "text") ?? null,
      delayMs,
      status: "pending"
    });

    const recipientRows = recipients.map((recipient) => ({
      id: crypto.randomUUID(),
      broadcastId: broadcast.id,
      phoneNumber: normalizePhoneNumber(recipient.to),
      variables: JSON.stringify(recipient.variables),
      status: "pending" as const,
      errorMessage: null,
      sentAt: null
    }));
    this.databaseService.broadcasts.createRecipients(recipientRows);
    this.databaseService.broadcasts.updateStatus(broadcast.id, "processing");

    for (const [index, recipient] of recipientRows.entries()) {
      const bodyPayload = await this.buildMessagePayload(userId, payload, JSON.parse(recipient.variables ?? "{}") as Record<string, unknown>);
      void this.messageService
        .enqueueBroadcastMessage({
          userId,
          sessionId,
          to: recipient.phoneNumber,
          type: bodyPayload.type,
          content: bodyPayload.content,
          broadcastId: broadcast.id,
          delayMs: index * delayMs
        })
        .then((message) => {
          this.databaseService.broadcasts.updateRecipientStatus(recipient.id, message.status === "sent" ? "sent" : "failed", message.errorMessage ?? undefined);
          this.refreshBroadcastStatus(userId, broadcast.id);
        })
        .catch((error) => {
          this.databaseService.broadcasts.updateRecipientStatus(recipient.id, "failed", error instanceof Error ? error.message : "Send failed");
          this.refreshBroadcastStatus(userId, broadcast.id);
        });
    }

    return {
      broadcast,
      recipients: recipientRows.length
    };
  }

  public report(userId: string, id: string) {
    const broadcast = this.databaseService.broadcasts.findById(id, userId);
    if (!broadcast) {
      throw new AppError(404, "NOT_FOUND", "Broadcast not found");
    }
    const recipients = this.databaseService.broadcasts.listRecipients(id);
    const report = {
      total: recipients.length,
      sent: recipients.filter((recipient) => recipient.status === "sent").length,
      failed: recipients.filter((recipient) => recipient.status === "failed").length,
      pending: recipients.filter((recipient) => recipient.status === "pending").length
    };
    return { broadcast, report, recipients };
  }

  private async extractRecipients(payload: Record<string, unknown>): Promise<Array<{ to: string; variables: Record<string, unknown> }>> {
    if (payload.csv instanceof File) {
      const text = await payload.csv.text();
      return parseCsvRecipients(text);
    }
    if (typeof payload.raw === "string") {
      return parseCsvRecipients(payload.raw);
    }
    return requireArray(payload.recipients, "recipients").map((entry, index) => {
      if (typeof entry === "string") {
        return { to: entry, variables: {} };
      }
      const row = asRecord(entry, `recipients[${index}] must be an object`);
      return {
        to: requireString(row.to, `recipients[${index}].to`),
        variables: asRecord(row.variables ?? {})
      };
    });
  }

  private async buildMessagePayload(userId: string, payload: Record<string, unknown>, variables: Record<string, unknown>) {
    const templateId = optionalString(payload.templateId, "templateId");
    if (templateId) {
      const template = this.templateService.get(templateId, userId);
      const rendered = renderTemplate(template, variables);
      return { type: rendered.type, content: rendered.payload };
    }
    return {
      type: "text" as const,
      content: {
        text: requireString(payload.text, "text").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(variables[key] ?? ""))
      }
    };
  }

  private refreshBroadcastStatus(userId: string, broadcastId: string): void {
    const broadcast = this.databaseService.broadcasts.findById(broadcastId, userId);
    if (!broadcast) {
      return;
    }
    const recipients = this.databaseService.broadcasts.listRecipients(broadcastId);
    const pending = recipients.some((recipient) => recipient.status === "pending");
    const failed = recipients.some((recipient) => recipient.status === "failed");
    if (pending) {
      return;
    }
    this.databaseService.broadcasts.updateStatus(broadcastId, failed ? "failed" : "completed");
  }
}

function parseCsvRecipients(csv: string): Array<{ to: string; variables: Record<string, unknown> }> {
  const [headerLine, ...rows] = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!headerLine) {
    return [];
  }
  const headers = headerLine.split(",").map((value) => value.trim());
  return rows.map((row) => {
    const values = row.split(",").map((value) => value.trim());
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const to = String(record.to ?? record.phone ?? record.number ?? "");
    return {
      to,
      variables: record
    };
  }).filter((entry) => entry.to.length > 0);
}
