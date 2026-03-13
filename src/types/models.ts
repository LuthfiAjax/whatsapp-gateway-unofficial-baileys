export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyHint: string;
  scopes: string;
  ipWhitelist: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: number;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = "connected" | "connecting" | "disconnected" | "banned";

export interface SessionRecord {
  id: string;
  userId: string;
  sessionName: string;
  phoneNumber: string | null;
  status: SessionStatus;
  webhookUrl: string | null;
  deviceInfo: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthStateRecord {
  sessionId: string;
  creds: string;
  keys: string;
  updatedAt: string;
}

export interface MessageLogRecord {
  id: string;
  sessionId: string;
  userId: string;
  eventType: string;
  payload: string;
  createdAt: string;
}

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";
export type TemplateType = "text" | "image" | "video" | "document" | "audio" | "location" | "contact" | "buttons" | "list";

export interface MessageRecord {
  id: string;
  userId: string;
  sessionId: string;
  broadcastId: string | null;
  recipient: string;
  messageType: TemplateType;
  payload: string;
  status: MessageStatus;
  errorMessage: string | null;
  retryCount: number;
  externalId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateRecord {
  id: string;
  userId: string;
  name: string;
  type: TemplateType;
  content: string;
  variables: string;
  createdAt: string;
  updatedAt: string;
}

export type BroadcastStatus = "pending" | "processing" | "completed" | "failed";

export interface BroadcastRecord {
  id: string;
  userId: string;
  sessionId: string;
  name: string;
  templateId: string | null;
  messageContent: string | null;
  delayMs: number;
  status: BroadcastStatus;
  createdAt: string;
  updatedAt: string;
}

export type BroadcastRecipientStatus = "pending" | "sent" | "failed";

export interface BroadcastRecipientRecord {
  id: string;
  broadcastId: string;
  phoneNumber: string;
  variables: string | null;
  status: BroadcastRecipientStatus;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookRecord {
  id: string;
  userId: string;
  url: string;
  events: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string | null;
  userId: string;
  sessionId: string | null;
  eventType: string;
  targetUrl: string;
  payload: string;
  status: "pending" | "success" | "failed";
  httpStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}

export interface LogRecord {
  id: string;
  userId: string | null;
  apiKeyId: string | null;
  requestId: string;
  ipAddress: string | null;
  method: string;
  path: string;
  statusCode: number;
  eventType: string;
  message: string;
  metadata: string | null;
  createdAt: string;
}
