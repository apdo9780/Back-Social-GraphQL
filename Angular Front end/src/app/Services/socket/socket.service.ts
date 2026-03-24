import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private readonly authService = inject(AuthService);
  private socket: Socket | null = null;

  protected readonly isConnectedSignal = signal(false);
  readonly isConnected = this.isConnectedSignal.asReadonly();

  connect(): void {
    const token = this.authService.getToken();

    if (!token) {
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    const socketUrl = new URL(environment.apiBaseUrl).origin;

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.isConnectedSignal.set(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnectedSignal.set(false);
    });

    this.socket.on('connect_error', () => {
      this.isConnectedSignal.set(false);
    });
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.disconnect();
    this.socket = null;
    this.isConnectedSignal.set(false);
  }

  emit<TPayload>(eventName: string, payload: TPayload): void {
    this.socket?.emit(eventName, payload);
  }

  on<TPayload>(eventName: string): Observable<TPayload> {
    return new Observable<TPayload>((subscriber) => {
      const socket = this.socket;

      if (!socket) {
        subscriber.complete();
        return;
      }

      const handler = (payload: TPayload) => subscriber.next(payload);
      socket.on(eventName, handler);

      return () => {
        socket.off(eventName, handler);
      };
    });
  }
}
