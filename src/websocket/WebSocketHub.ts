import type { GatewayEvent } from "../types/events";

type SessionSubscriptionMap = Map<string, Set<Bun.ServerWebSocket<ClientSocketData>>>;

export interface ClientSocketData {
  sessionIds: Set<string>;
}

export class WebSocketHub {
  private readonly subscriptions: SessionSubscriptionMap = new Map();

  public subscribe(socket: Bun.ServerWebSocket<ClientSocketData>, sessionId: string): void {
    let bucket = this.subscriptions.get(sessionId);
    if (!bucket) {
      bucket = new Set();
      this.subscriptions.set(sessionId, bucket);
    }

    bucket.add(socket);
    socket.data.sessionIds.add(sessionId);
  }

  public unsubscribeAll(socket: Bun.ServerWebSocket<ClientSocketData>): void {
    for (const sessionId of socket.data.sessionIds) {
      const bucket = this.subscriptions.get(sessionId);
      bucket?.delete(socket);
      if (bucket && bucket.size === 0) {
        this.subscriptions.delete(sessionId);
      }
    }
    socket.data.sessionIds.clear();
  }

  public emit(event: GatewayEvent): void {
    const sockets = this.subscriptions.get(event.sessionId);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const payload = JSON.stringify(event);
    for (const socket of sockets) {
      socket.send(payload);
    }
  }
}
