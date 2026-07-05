import type { WebSocket } from 'ws';
import type { MatchTick } from '../feed/types.js';
import { log } from '../log.js';

// Fan-out hub. Each connected client receives every MatchTick as one JSON text frame, exactly
// the object app/src/mock/mockFeed.ts hands to its onTick callback. A late joiner immediately
// gets the most recent tick so the race renders current state instead of a blank track.
export class WsHub {
  private clients = new Set<WebSocket>();
  private lastTick: MatchTick | null = null;

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
    socket.on('error', () => this.clients.delete(socket));
    if (this.lastTick !== null) this.send(socket, this.lastTick);
    log.info(`ws: client connected (${this.clients.size} total)`);
  }

  broadcast(tick: MatchTick): void {
    this.lastTick = tick;
    const frame = JSON.stringify(tick);
    for (const socket of this.clients) {
      if (socket.readyState === socket.OPEN) socket.send(frame);
    }
  }

  private send(socket: WebSocket, tick: MatchTick): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(tick));
  }

  get size(): number {
    return this.clients.size;
  }
}
