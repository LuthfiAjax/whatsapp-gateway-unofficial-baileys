export type GatewayEventType =
  | "qr"
  | "pairing_code"
  | "connection_update"
  | "message.received"
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "session.connected"
  | "session.disconnected"
  | "group_update"
  | "presence_update"
  | "call_event";

export interface GatewayEvent<T = unknown> {
  type: GatewayEventType;
  sessionId: string;
  userId: string;
  occurredAt: string;
  payload: T;
}
