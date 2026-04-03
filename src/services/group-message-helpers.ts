import { AppError } from "../utils/errors";
import { asRecord, optionalString, requireString } from "../utils/validation";

interface GroupSendMessagePayload {
  groupJid: string;
  imageUrl: string | undefined;
  message: string | undefined;
}

export interface GroupSendMessageRequest {
  groupJid: string;
  type: "text" | "image";
  content: Record<string, unknown>;
  message: string | null;
  imageUrl: string | null;
}

export function buildGroupSendMessageRequest(body: unknown): GroupSendMessageRequest {
  const payload = asRecord(body);
  const groupPayload: GroupSendMessagePayload = {
    groupJid: requireString(payload.groupJid, "groupJid"),
    imageUrl: optionalString(payload.imageUrl, "imageUrl"),
    message: optionalString(payload.message, "message")
  };

  if (!groupPayload.groupJid.endsWith("@g.us")) {
    throw new AppError(400, "VALIDATION_ERROR", "groupJid must be a valid WhatsApp group JID");
  }

  if (groupPayload.imageUrl) {
    return {
      groupJid: groupPayload.groupJid,
      type: "image",
      content: {
        image: { url: groupPayload.imageUrl },
        ...(groupPayload.message ? { caption: groupPayload.message } : {})
      },
      message: groupPayload.message ?? null,
      imageUrl: groupPayload.imageUrl
    };
  }

  if (!groupPayload.message) {
    throw new AppError(400, "VALIDATION_ERROR", "message must be a non-empty string");
  }

  return {
    groupJid: groupPayload.groupJid,
    type: "text",
    content: { text: groupPayload.message },
    message: groupPayload.message,
    imageUrl: null
  };
}
