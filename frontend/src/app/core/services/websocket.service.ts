import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Room, TimerState } from '../models/models';

interface WsMessage {
  event: string;
  room?: Room;
  userId?: string;
  timer?: TimerState;
}

/**
 * Manages a single WebSocket connection to the room stream. The server is the
 * source of truth and pushes the full room snapshot on every change, so this
 * service simply forwards those snapshots and handles reconnection + keepalive.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: WebSocket | null = null;
  private roomId = '';
  private userId = '';
  private shouldReconnect = false;
  private reconnectDelay = 1000;
  private keepAliveTimer: any = null;

  /** Emits the room snapshot on every server push. */
  readonly room$ = new Subject<Room>();
  /** Emits the raw event name (e.g. "revealed", "user_joined"). */
  readonly event$ = new Subject<string>();
  /** Emits connection status changes. */
  readonly status$ = new Subject<'open' | 'closed' | 'error'>();
  /** Emits the user id that was removed by an admin. */
  readonly kicked$ = new Subject<string>();
  /** Emits the canonical timer state on each per-second server tick. */
  readonly timer$ = new Subject<TimerState>();

  connect(roomId: string, userId: string): void {
    this.roomId = roomId;
    this.userId = userId;
    this.shouldReconnect = true;
    this.open();
  }

  private open(): void {
    const url = `${environment.wsBase}/ws/${this.roomId}/${this.userId}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.reconnectDelay = 1000;
      this.status$.next('open');
      this.keepAliveTimer = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send('ping');
        }
      }, 25000);
    };

    this.socket.onmessage = (ev) => {
      try {
        const msg: WsMessage = JSON.parse(ev.data);
        if (msg.event === 'kicked') {
          if (msg.userId) this.kicked$.next(msg.userId);
          return;
        }
        if (msg.event === 'timer_tick') {
          // Lightweight per-second frame: just the canonical timer state.
          if (msg.timer) this.timer$.next(msg.timer);
          return;
        }
        if (msg.room) {
          this.room$.next(msg.room);
          // A full snapshot also carries authoritative timer state.
          if (msg.room.timer) this.timer$.next(msg.room.timer);
        }
        if (msg.event) this.event$.next(msg.event);
      } catch {
        /* ignore malformed frames */
      }
    };

    this.socket.onerror = () => this.status$.next('error');

    this.socket.onclose = () => {
      this.status$.next('closed');
      this.clearKeepAlive();
      if (this.shouldReconnect) {
        setTimeout(() => this.open(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.6, 10000);
      }
    };
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearKeepAlive();
    this.socket?.close();
    this.socket = null;
  }
}
