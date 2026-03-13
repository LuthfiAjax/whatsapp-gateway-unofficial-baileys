import type { DatabaseService } from "../database/DatabaseService";
import type { MessageRecord, TemplateType } from "../types/models";
import { AppError } from "../utils/errors";
import { asRecord, optionalBoolean, optionalNullableString, optionalString, requireArray, requireObjectArray, requireString } from "../utils/validation";
import { SessionManager } from "../session/SessionManager";
import { EventRouter } from "./EventRouter";
import { MessageQueue } from "./MessageQueue";
import { normalizePhoneNumber, renderTemplate, toPublicPhoneNumber } from "./message-helpers";
import { TemplateService } from "./TemplateService";

interface QueueMessageInput {
  userId: string;
  sessionId: string;
  to: string;
  type: TemplateType;
  content: Record<string, unknown>;
  broadcastId?: string | null;
  delayMs?: number;
}

export class MessageService {
  public constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionManager: SessionManager,
    private readonly queue: MessageQueue,
    private readonly eventRouter: EventRouter,
    private readonly templateService: TemplateService
  ) {}

  public async sendText(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "text",
      content: { text: requireString(payload.text, "text") }
    });
  }

  public async sendMedia(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    const mediaType = requireString(payload.mediaType, "mediaType");
    switch (mediaType) {
      case "image":
        return this.sendImage(userId, sessionId, body);
      case "video":
        return this.sendVideo(userId, sessionId, body);
      case "audio":
        return this.sendAudio(userId, sessionId, body);
      case "document":
      case "file":
        return this.sendDocument(userId, sessionId, body);
      default:
        throw new AppError(400, "VALIDATION_ERROR", "mediaType must be image, video, audio, or document");
    }
  }

  public async sendImage(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "image",
      content: this.withMediaUrl(payload, "image")
    });
  }

  public async sendVideo(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "video",
      content: this.withMediaUrl(payload, "video")
    });
  }

  public async sendAudio(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "audio",
      content: {
        audio: { url: requireString(payload.url, "url") },
        mimetype: optionalString(payload.mimeType, "mimeType") ?? "audio/ogg",
        ptt: optionalBoolean(payload.ptt, "ptt") ?? false
      }
    });
  }

  public async sendDocument(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "document",
      content: {
        document: { url: requireString(payload.url, "url") },
        mimetype: optionalString(payload.mimeType, "mimeType") ?? "application/octet-stream",
        fileName: optionalString(payload.fileName, "fileName") ?? "document",
        caption: optionalString(payload.caption, "caption")
      }
    });
  }

  public async sendLocation(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "location",
      content: {
        location: {
          degreesLatitude: Number(payload.latitude),
          degreesLongitude: Number(payload.longitude),
          name: optionalString(payload.name, "name"),
          address: optionalString(payload.address, "address")
        }
      }
    });
  }

  public async sendContact(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    const contacts = requireObjectArray(payload.contacts, "contacts").map((contact) => ({
      displayName: requireString(contact.displayName, "displayName"),
      vcard: requireString(contact.vcard, "vcard")
    }));
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "contact",
      content: { contacts }
    });
  }

  public async sendButtons(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    const buttons = requireObjectArray(payload.buttons, "buttons").map((button, index) => ({
      buttonId: optionalString(button.id, `buttons[${index}].id`) ?? `btn-${index + 1}`,
      buttonText: { displayText: requireString(button.text, `buttons[${index}].text`) },
      type: 1
    }));
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "buttons",
      content: {
        text: requireString(payload.text, "text"),
        footer: optionalString(payload.footer, "footer"),
        buttons
      }
    });
  }

  public async sendList(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    const sections = requireObjectArray(payload.sections, "sections").map((section, sectionIndex) => ({
      title: requireString(section.title, `sections[${sectionIndex}].title`),
      rows: requireObjectArray(section.rows, `sections[${sectionIndex}].rows`).map((row, rowIndex) => ({
        rowId: optionalString(row.id, `sections[${sectionIndex}].rows[${rowIndex}].id`) ?? `row-${rowIndex + 1}`,
        title: requireString(row.title, `sections[${sectionIndex}].rows[${rowIndex}].title`),
        description: optionalString(row.description, `sections[${sectionIndex}].rows[${rowIndex}].description`)
      }))
    }));
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: "list",
      content: {
        text: requireString(payload.text, "text"),
        footer: optionalString(payload.footer, "footer"),
        title: optionalString(payload.title, "title"),
        buttonText: requireString(payload.buttonText, "buttonText"),
        sections
      }
    });
  }

  public async sendTemplate(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    const template = this.templateService.get(requireString(payload.templateId, "templateId"), userId);
    const rendered = renderTemplate(template, asRecord(payload.variables ?? {}));
    return this.sendSingle({
      userId,
      sessionId,
      to: requireString(payload.to, "to"),
      type: rendered.type,
      content: rendered.payload
    });
  }

  public async sendBulk(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const payload = asRecord(body);
    const recipients = requireArray(payload.recipients, "recipients").map((item, index) => {
      if (typeof item === "string") {
        return { to: item, variables: {} };
      }
      const row = asRecord(item, `recipients[${index}] must be a string or object`);
      return { to: requireString(row.to, `recipients[${index}].to`), variables: asRecord(row.variables ?? {}) };
    });
    const delayMs = typeof payload.delayMs === "number" ? payload.delayMs : 0;

    const items = await Promise.all(
      recipients.map((recipient, index) =>
        this.enqueueMessage({
          userId,
          sessionId,
          to: recipient.to,
          type: "text",
          content: { text: renderTemplateText(payload, recipient.variables) },
          delayMs: index * delayMs
        })
      )
    );

    return { queued: items.length, items };
  }

  public async enqueueBroadcastMessage(input: QueueMessageInput): Promise<MessageRecord> {
    return this.enqueueMessage(input);
  }

  private async sendSingle(input: QueueMessageInput): Promise<unknown> {
    const message = await this.enqueueMessage(input);
    const updated = this.databaseService.messages.findById(message.id);
    return {
      message: updated,
      provider: updated?.externalId ? { id: updated.externalId } : null
    };
  }

  private withMediaUrl(payload: Record<string, unknown>, mediaKey: "image" | "video") {
    const caption = optionalNullableString(payload.caption, "caption");
    return {
      [mediaKey]: { url: requireString(payload.url, "url") },
      ...(caption ? { caption } : {})
    };
  }

  private async enqueueMessage(input: QueueMessageInput): Promise<MessageRecord> {
    const normalizedRecipient = normalizePhoneNumber(input.to);
    const message = this.databaseService.messages.create({
      id: crypto.randomUUID(),
      userId: input.userId,
      sessionId: input.sessionId,
      broadcastId: input.broadcastId ?? null,
      recipient: normalizedRecipient,
      messageType: input.type,
      payload: JSON.stringify(input.content),
      status: "queued",
      scheduledAt: new Date(Date.now() + (input.delayMs ?? 0)).toISOString()
    });

    const job = async () => {
      const socket = this.sessionManager.getInstance(input.sessionId, input.userId).requireSocket();
      const providerResult = await socket.sendMessage(normalizedRecipient, input.content as any);
      this.databaseService.messages.updateStatus(message.id, "sent", {
        externalId: providerResult?.key?.id ?? null
      });
      this.eventRouter.emit(this.sessionManager.getSession(input.sessionId, input.userId), "message.sent", {
        messageId: message.id,
        to: toPublicPhoneNumber(normalizedRecipient),
        providerMessageId: providerResult?.key?.id ?? null
      });
      return this.databaseService.messages.findById(message.id)!;
    };

    const queued = this.queue.enqueue<MessageRecord>({
      id: message.id,
      availableAt: Date.now() + (input.delayMs ?? 0),
      maxAttempts: 3,
      run: async () => {
        try {
          return await job();
        } catch (error) {
          const current = this.databaseService.messages.findById(message.id);
          this.databaseService.messages.updateStatus(message.id, "failed", {
            retryCount: (current?.retryCount ?? 0) + 1,
            errorMessage: error instanceof Error ? error.message : "Unknown send failure"
          });
          throw error;
        }
      }
    });

    try {
      return await queued;
    } catch {
      const failed = this.databaseService.messages.findById(message.id);
      if (!failed) {
        throw new AppError(500, "INTERNAL_SERVER_ERROR", "Message send failed");
      }
      return failed;
    }
  }
}

function renderTemplateText(payload: Record<string, unknown>, variables: Record<string, unknown>): string {
  if (typeof payload.text === "string") {
    return payload.text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(variables[key] ?? ""));
  }
  throw new AppError(400, "VALIDATION_ERROR", "bulk text is required");
}
