import type { SessionRecord, SessionStatus, AuthStateRecord, UserRecord } from "./models";

export type { SessionStatus, SessionRecord, AuthStateRecord, UserRecord };

export interface SessionCreateInput {
  userId: string;
  sessionName: string;
  phoneNumber?: string | null;
  webhookUrl?: string | null;
}

export interface SessionConnectInput {
  method: "qr";
  phoneNumber?: string | null;
}

export interface SessionWebhookInput {
  webhookUrl: string | null;
}

export interface SessionUpdateInput {
  sessionName?: string;
  webhookUrl?: string | null;
  deviceInfo?: string | null;
  lastSeenAt?: string | null;
}

export interface SessionPhoneUpdateInput {
  phoneNumber: string;
}

export interface SessionConnectResult {
  session: SessionRecord;
  state: "connected" | "awaiting_qr";
  qrCodeBase64: string | null;
}
