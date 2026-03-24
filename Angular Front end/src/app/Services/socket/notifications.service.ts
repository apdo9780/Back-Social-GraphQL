import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { FriendsService } from '../api/friends.service';
import { Chat, Message } from '../../shared/models';
import { SocketService } from './socket.service';

export type NotificationKind = 'message' | 'friend' | 'post' | 'status' | 'system';
export type PresenceState = 'online' | 'offline' | 'away';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  createdAt: string;
  read: boolean;
  target?: {
    route: string;
    queryParams?: Record<string, string>;
  };
}

export interface AppToast {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  createdAt: string;
  target?: {
    route: string;
    queryParams?: Record<string, string>;
  };
}

interface UserStatusChangedPayload {
  userId: string;
  status: PresenceState;
  timestamp: string;
}

interface PostInteractionPayload {
  type: 'like' | 'comment';
  postId: string;
  commentId?: string;
  actorId?: string;
  actorName?: string;
}

interface LegacyPostNotificationPayload {
  message?: string;
  postId?: string;
  commentId?: string;
  actorId?: string;
  actorName?: string;
}

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private readonly authService = inject(AuthService);
  private readonly friendsService = inject(FriendsService);
  private readonly socketService = inject(SocketService);

  private readonly notificationsSignal = signal<AppNotification[]>([]);
  private readonly toastsSignal = signal<AppToast[]>([]);
  private readonly presenceSignal = signal<Record<string, PresenceState>>({});
  private readonly unreadByChatSignal = signal<Record<string, number>>({});
  private readonly pendingFriendRequestsSignal = signal(0);
  private readonly activeChatIdSignal = signal<string | null>(null);
  private readonly currentUserIdSignal = signal<string | null>(null);
  private readonly socketSubscriptions: Subscription[] = [];
  private readonly toastTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly recentPostNotificationKeys = new Map<string, number>();
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly toasts = this.toastsSignal.asReadonly();
  readonly unreadCount = computed(() => this.notificationsSignal().filter((item) => !item.read).length);
  readonly unreadByChat = this.unreadByChatSignal.asReadonly();
  readonly pendingFriendRequests = this.pendingFriendRequestsSignal.asReadonly();
  readonly unreadChatsTotal = computed(() =>
    Object.values(this.unreadByChatSignal()).reduce((total, count) => total + count, 0)
  );

  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    this.socketService.connect();

    this.authService.me().subscribe({
      next: (user) => {
        this.currentUserIdSignal.set(user._id);
      }
    });

    this.friendsService.getFriendRequests().subscribe({
      next: (requests) => {
        this.pendingFriendRequestsSignal.set(requests.length);
      }
    });

    this.socketSubscriptions.push(
      this.socketService.on<{ sender?: { username?: string; _id?: string } }>('new_friend_request').subscribe((payload) => {
        this.pendingFriendRequestsSignal.update((count) => count + 1);
        this.push({
          title: 'New friend request',
          message: `${payload.sender?.username ?? 'A user'} sent you a friend request.`,
          kind: 'friend',
          target: {
            route: '/friends'
          }
        });
      })
    );

    this.socketSubscriptions.push(
      this.socketService.on<{ status: 'accepted' | 'rejected'; user?: { username?: string } }>('friend_request_response').subscribe((payload) => {
        const action = payload.status === 'accepted' ? 'accepted' : 'rejected';
        this.push({
          title: 'Friend request update',
          message: `${payload.user?.username ?? 'A user'} ${action} your friend request.`,
          kind: 'friend',
          target: {
            route: '/friends'
          }
        });
      })
    );

    this.socketSubscriptions.push(
      this.socketService.on<{ chat?: { chatName?: string } }>('new_chat').subscribe((payload) => {
        this.push({
          title: 'New chat',
          message: `You have a new conversation: ${payload.chat?.chatName ?? 'Direct chat'}.`,
          kind: 'message',
          target: {
            route: '/chats'
          }
        });
      })
    );

    this.socketSubscriptions.push(
      this.socketService.on<{ message?: Message; chat?: Chat | string }>('new_message').subscribe((payload) => {
        const message = payload.message;

        if (!message) {
          return;
        }

        const senderId = typeof message.sender === 'string' ? message.sender : message.sender?._id;

        if (senderId && senderId === this.currentUserIdSignal()) {
          return;
        }

        const messageChatId = this.extractMessageChatId(message, payload.chat);

        if (!messageChatId) {
          return;
        }

        if (this.activeChatIdSignal() === messageChatId) {
          this.clearUnreadForChat(messageChatId);
          return;
        }

        this.incrementUnreadForChat(messageChatId);

        this.push({
          title: 'New message',
          message: `${typeof message.sender === 'string' ? 'Someone' : message.sender?.username ?? 'Someone'} sent you a new message.`,
          kind: 'message',
          target: {
            route: '/chats',
            queryParams: {
              chatId: messageChatId
            }
          }
        });
      })
    );

    this.socketSubscriptions.push(
      this.socketService.on<PostInteractionPayload>('post_interaction').subscribe((payload) => {
        this.pushPostNotification(payload.type, payload);
      })
    );

    this.socketSubscriptions.push(
      this.socketService.on<LegacyPostNotificationPayload>('new Like').subscribe((payload) => {
        this.pushPostNotification('like', payload);
      })
    );

    this.socketSubscriptions.push(
      this.socketService.on<LegacyPostNotificationPayload>('new Comment').subscribe((payload) => {
        this.pushPostNotification('comment', payload);
      })
    );

    this.socketSubscriptions.push(
      this.socketService.on<UserStatusChangedPayload>('user_status_changed').subscribe((payload) => {
        this.presenceSignal.update((current) => ({
          ...current,
          [payload.userId]: payload.status
        }));
      })
    );
  }

  destroy(): void {
    for (const subscription of this.socketSubscriptions) {
      subscription.unsubscribe();
    }

    for (const timer of this.toastTimers.values()) {
      clearTimeout(timer);
    }

    this.socketSubscriptions.length = 0;
    this.toastTimers.clear();

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
  }

  dismissToast(toastId: string): void {
    const timer = this.toastTimers.get(toastId);

    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(toastId);
    }

    this.toastsSignal.update((items) => items.filter((item) => item.id !== toastId));
  }

  markAllAsRead(): void {
    this.notificationsSignal.update((items) => items.map((item) => ({ ...item, read: true })));
  }

  getPresence(userId: string): PresenceState {
    return this.presenceSignal()[userId] ?? 'offline';
  }

  setUnreadForChat(chatId: string, count: number): void {
    this.unreadByChatSignal.update((current) => ({
      ...current,
      [chatId]: Math.max(0, count)
    }));
  }

  incrementUnreadForChat(chatId: string): void {
    this.unreadByChatSignal.update((current) => ({
      ...current,
      [chatId]: (current[chatId] ?? 0) + 1
    }));
  }

  setUnreadMap(unreadByChat: Record<string, number>): void {
    this.unreadByChatSignal.set(unreadByChat);
  }

  clearUnreadForChat(chatId: string): void {
    this.unreadByChatSignal.update((current) => ({
      ...current,
      [chatId]: 0
    }));
  }

  push(payload: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
    const notification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...payload
    };

    this.notificationsSignal.update((items) => [notification, ...items].slice(0, 40));
    this.playNotificationSound();

    if (
      notification.kind === 'message' ||
      notification.kind === 'friend' ||
      notification.kind === 'post' ||
      notification.kind === 'system'
    ) {
      this.pushToast(notification);
    }
  }

  private playNotificationSound(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const audioContextConstructor =
      window.AudioContext ??
      (window as WindowWithWebkitAudioContext).webkitAudioContext;

    if (!audioContextConstructor) {
      return;
    }

    try {
      this.audioContext ??= new audioContextConstructor();

      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }

      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const startTime = this.audioContext.currentTime;

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, startTime + 0.12);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.07, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15);

      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.16);
    } catch {
      // Ignore browser autoplay/audio context restrictions.
    }
  }

  private pushToast(notification: AppNotification): void {
    const toast: AppToast = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      kind: notification.kind,
      createdAt: notification.createdAt,
      target: notification.target
    };

    this.toastsSignal.update((items) => [toast, ...items].slice(0, 4));

    const timer = setTimeout(() => {
      this.dismissToast(toast.id);
    }, 5000);

    this.toastTimers.set(toast.id, timer);
  }

  setPendingFriendRequestsCount(count: number): void {
    this.pendingFriendRequestsSignal.set(Math.max(0, count));
  }

  incrementPendingFriendRequests(count = 1): void {
    this.pendingFriendRequestsSignal.update((currentCount) => Math.max(0, currentCount + count));
  }

  decrementPendingFriendRequests(count = 1): void {
    this.pendingFriendRequestsSignal.update((currentCount) => Math.max(0, currentCount - count));
  }

  setActiveChat(chatId: string | null): void {
    this.activeChatIdSignal.set(chatId);

    if (chatId) {
      this.clearUnreadForChat(chatId);
    }
  }

  private extractMessageChatId(message: Message, payloadChat?: Chat | string): string | null {
    const rawChat = (message.chat as Chat | string | undefined) ?? payloadChat;

    if (!rawChat) {
      return null;
    }

    if (typeof rawChat === 'string') {
      return rawChat;
    }

    return rawChat._id ?? null;
  }

  private pushPostNotification(
    type: 'like' | 'comment',
    payload: Pick<LegacyPostNotificationPayload, 'postId' | 'commentId' | 'actorId' | 'actorName' | 'message'>
  ): void {
    if (!payload.postId) {
      return;
    }

    const key = `${type}:${payload.postId}:${payload.commentId ?? ''}:${payload.actorId ?? ''}`;
    const now = Date.now();
    const previousTimestamp = this.recentPostNotificationKeys.get(key);

    // De-duplicate quick back-to-back events when backend emits both modern and legacy event names.
    if (typeof previousTimestamp === 'number' && now - previousTimestamp < 1500) {
      return;
    }

    this.recentPostNotificationKeys.set(key, now);

    if (this.recentPostNotificationKeys.size > 200) {
      const staleThreshold = now - 60_000;

      for (const [recentKey, timestamp] of this.recentPostNotificationKeys.entries()) {
        if (timestamp < staleThreshold) {
          this.recentPostNotificationKeys.delete(recentKey);
        }
      }
    }

    const actorName = payload.actorName ?? 'Someone';
    const fallbackMessage = type === 'like' ? `${actorName} liked your post.` : `${actorName} commented on your post.`;

    this.push({
      title: type === 'like' ? 'New like on your post' : 'New comment on your post',
      message: payload.message ?? fallbackMessage,
      kind: 'post',
      target: {
        route: '/',
        queryParams: {
          postId: payload.postId,
          ...(payload.commentId ? { commentId: payload.commentId } : {})
        }
      }
    });
  }
}
