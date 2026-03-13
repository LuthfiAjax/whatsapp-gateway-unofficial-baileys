import type { ApiKeyRecord, SessionRecord, UserRecord } from "./models";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorShape {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type AuthKind = "jwt" | "api_key";

export interface RequestContext {
  request: Request;
  params: Record<string, string>;
  body: any;
  userId?: string;
  user?: UserRecord | null;
  apiKey?: string;
  apiKeyRecord?: ApiKeyRecord | null;
  authKind?: AuthKind;
  requestId: string;
  ipAddress: string | null;
}

export interface SessionListResponse {
  items: SessionRecord[];
}
