import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../Services/auth/auth.service';
import { ChatsService } from '../../Services/api/chats.service';
import { NotificationsService } from '../../Services/socket/notifications.service';
import { SocketService } from '../../Services/socket/socket.service';
import { Chat, Message, User } from '../../shared/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chats.component.html',
  styleUrl: './chats.component.scss'
})
export class ChatsComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly chatsService = inject(ChatsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly socketService = inject(SocketService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly threadScrollRef = viewChild<ElementRef<HTMLDivElement>>('threadScroll');

  private readonly socketSubscriptions: Subscription[] = [];
  private currentJoinedChatId: string | null = null;
  private typingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  protected readonly chats = signal<Chat[]>([]);
  protected readonly selectedChatId = signal<string | null>(null);
  protected readonly messages = signal<Message[]>([]);
  protected readonly isLoadingChats = signal(false);
  protected readonly isLoadingMessages = signal(false);
  protected readonly isSendingMessage = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly typingLabel = signal('');
  protected readonly currentUserId = signal<string | null>(null);
  protected readonly currentUserEmail = signal<string | null>(null);
  protected readonly unreadCountByChatId = this.notificationsService.unreadByChat;
  protected readonly requestedChatId = signal<string | null>(null);

  protected readonly sendMessageForm = this.formBuilder.nonNullable.group({
    content: ['', [Validators.required, Validators.minLength(1)]]
  });

  protected readonly selectedChat = computed(() =>
    this.chats().find((chat) => chat._id === this.selectedChatId()) ?? null
  );

  constructor() {
    this.seedCurrentUserFromToken();
    this.socketService.connect();
    this.initializeSocketListeners();
    this.route.queryParamMap.subscribe((params) => {
      this.requestedChatId.set(params.get('chatId'));
      this.tryOpenRequestedChat();
    });
    this.loadCurrentUser();
    this.loadChats();
  }

  ngOnDestroy(): void {
    if (this.currentJoinedChatId) {
      this.markThreadRead(this.currentJoinedChatId);
      this.socketService.emit('leave_chat', this.currentJoinedChatId);
    }

    this.notificationsService.setActiveChat(null);

    if (this.typingTimeoutId) {
      clearTimeout(this.typingTimeoutId);
      this.typingTimeoutId = null;
    }

    for (const subscription of this.socketSubscriptions) {
      subscription.unsubscribe();
    }

    this.socketSubscriptions.length = 0;
  }

  protected loadChats(): void {
    this.isLoadingChats.set(true);
    this.chatsService.getChats().subscribe({
      next: (chats) => {
        this.chats.set(chats);
        this.recomputeUnreadCounts(chats);
        this.tryOpenRequestedChat();
        this.isLoadingChats.set(false);
      },
      error: () => {
        this.statusMessage.set('Failed to load chats.');
        this.isLoadingChats.set(false);
      }
    });
  }

  protected selectChat(chatId: string): void {
    if (this.currentJoinedChatId && this.currentJoinedChatId !== chatId) {
      this.markThreadRead(this.currentJoinedChatId);
      this.socketService.emit('leave_chat', this.currentJoinedChatId);
    }

    this.socketService.emit('join_chat', chatId);
    this.currentJoinedChatId = chatId;
    this.selectedChatId.set(chatId);
    this.notificationsService.setActiveChat(chatId);
    this.typingLabel.set('');
    this.notificationsService.clearUnreadForChat(chatId);
    this.loadMessages(chatId);
  }

  protected sendMessage(): void {
    const selectedChatId = this.selectedChatId();

    if (this.sendMessageForm.invalid || !selectedChatId || this.isSendingMessage()) {
      this.sendMessageForm.markAllAsTouched();
      return;
    }

    const formCopy = this.sendMessageForm.getRawValue().content;
    this.isSendingMessage.set(true);

    this.chatsService
      .sendMessage({
        chatId: selectedChatId,
        content: formCopy
      })
      .subscribe({
        next: (message) => {
          this.messages.set([...this.messages(), message]);
          this.sendMessageForm.reset();
          this.socketService.emit('typing_status', {
            chatId: selectedChatId,
            isTyping: false
          });
          this.statusMessage.set('');
          this.isSendingMessage.set(false);
          this.scrollThreadToBottom();
        },
        error: (error: { error?: { error?: string } }) => {
          this.statusMessage.set(error.error?.error ?? 'Failed to send message.');
          this.isSendingMessage.set(false);
        }
      });
  }

  protected handleTyping(): void {
    const selectedChatId = this.selectedChatId();

    if (!selectedChatId) {
      return;
    }

    this.socketService.emit('typing_status', { chatId: selectedChatId, isTyping: true });

    if (this.typingTimeoutId) {
      clearTimeout(this.typingTimeoutId);
    }

    this.typingTimeoutId = setTimeout(() => {
      this.socketService.emit('typing_status', { chatId: selectedChatId, isTyping: false });
      this.typingTimeoutId = null;
    }, 1000);
  }

  protected getUnreadCount(chatId: string): number {
    return this.notificationsService.unreadByChat()[chatId] ?? 0;
  }

  protected getChatTitle(chat: Chat): string {
    if (chat.isGroupChat) {
      return chat.chatName || 'Group chat';
    }

    const otherUser = this.getOtherUser(chat);
    return otherUser?.username || chat.chatName || 'Direct chat';
  }

  protected getChatSubtitle(chat: Chat): string {
    if (chat.isGroupChat) {
      return 'Group chat';
    }

    const otherUser = this.getOtherUser(chat);
    return otherUser?.email || 'Direct chat';
  }

  protected getChatAvatar(chat: Chat): string {
    if (chat.isGroupChat) {
      return this.buildInitialsAvatar(this.getGroupInitials(chat));
    }

    const otherUser = this.getOtherUser(chat);

    if (!otherUser) {
      return this.buildInitialsAvatar('DM');
    }

    if (!otherUser.avatar || this.isInvalidAvatarPath(otherUser.avatar)) {
      return this.buildInitialsAvatar(this.getUserInitials(otherUser));
    }

    return this.getDisplayImage(otherUser.avatar);
  }

  protected onChatAvatarError(event: Event, chat: Chat): void {
    const target = event.target as HTMLImageElement | null;

    if (!target) {
      return;
    }

    const fallback = this.buildInitialsAvatar(chat.isGroupChat ? this.getGroupInitials(chat) : 'DM');

    if (target.src !== fallback) {
      target.src = fallback;
    }
  }

  protected isOwnMessage(message: Message): boolean {
    const sender = this.getResolvedMessageSender(message);
    const senderId = this.resolveEntityId(sender ?? message.sender);
    const currentUserId = this.resolveEntityId(this.currentUserId());

    if (senderId && currentUserId) {
      return senderId === currentUserId;
    }

    const senderEmail = sender?.email?.trim().toLowerCase() || '';
    const currentUserEmail = this.currentUserEmail()?.trim().toLowerCase() || '';

    if (senderEmail && currentUserEmail) {
      return senderEmail === currentUserEmail;
    }

    return false;
  }

  protected getMessageSenderName(message: Message): string {
    const sender = this.getResolvedMessageSender(message);
    return sender?.username || sender?.email || 'User';
  }

  protected getMessageAvatar(message: Message): string {
    const sender = this.getResolvedMessageSender(message);

    if (!sender) {
      return this.buildInitialsAvatar('U');
    }

    if (!sender.avatar || this.isInvalidAvatarPath(sender.avatar)) {
      return this.buildInitialsAvatar(this.getUserInitials(sender));
    }

    return this.getDisplayImage(sender.avatar);
  }

  protected onMessageAvatarError(event: Event, message: Message): void {
    const target = event.target as HTMLImageElement | null;

    if (!target) {
      return;
    }

    const sender = this.getResolvedMessageSender(message);
    const fallback = this.buildInitialsAvatar(sender ? this.getUserInitials(sender) : 'U');

    if (target.src !== fallback) {
      target.src = fallback;
    }
  }

  private loadMessages(chatId: string): void {
    this.isLoadingMessages.set(true);
    this.chatsService.getMessages(chatId).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.isLoadingMessages.set(false);
        this.chatsService.markMessagesAsRead(chatId).subscribe({
          error: () => {
            this.statusMessage.set('Messages loaded but read state could not be synced.');
          }
        });
      },
      error: () => {
        this.statusMessage.set('Failed to load messages.');
        this.isLoadingMessages.set(false);
      }
    });
  }

  private initializeSocketListeners(): void {
    this.socketSubscriptions.push(
      this.socketService.on<{ message?: Message }>('new_message').subscribe((payload) => {
        const incomingMessage = payload.message;

        if (!incomingMessage) {
          return;
        }

        const messageChatId = this.extractMessageChatId(incomingMessage);

        if (!messageChatId) {
          return;
        }

        if (this.selectedChatId() === messageChatId) {
          const exists = this.messages().some((message) => message._id === incomingMessage._id);
          if (!exists) {
            this.messages.set([...this.messages(), incomingMessage]);
          }
          this.notificationsService.clearUnreadForChat(messageChatId);
          return;
        }

        this.loadChats();
      })
    );

    this.socketSubscriptions.push(
      this.socketService
        .on<{ chatId: string; user?: { username?: string } }>('typing_started')
        .subscribe((payload) => {
          if (payload.chatId !== this.selectedChatId()) {
            return;
          }

          this.typingLabel.set(`${payload.user?.username ?? 'Someone'} is typing...`);
        })
    );

    this.socketSubscriptions.push(
      this.socketService.on<{ chatId: string }>('typing_stopped').subscribe((payload) => {
        if (payload.chatId !== this.selectedChatId()) {
          return;
        }

        this.typingLabel.set('');
      })
    );
  }

  private extractMessageChatId(message: Message): string | null {
    const chat = message.chat as Chat | string | undefined;

    if (!chat) {
      return null;
    }

    if (typeof chat === 'string') {
      return chat;
    }

    return chat._id ?? null;
  }

  private getMessageSender(message: Message): User | null {
    if (!message.sender || typeof message.sender === 'string') {
      return null;
    }

    return message.sender as User;
  }

  private getResolvedMessageSender(message: Message): User | null {
    const directSender = this.getMessageSender(message);

    if (
      directSender?.username &&
      (directSender.avatar || directSender.firstName || directSender.lastName)
    ) {
      return directSender;
    }

    const senderId = this.resolveEntityId(message.sender);

    if (!senderId) {
      return directSender;
    }

    const fromChatUsers = this.selectedChat()?.users?.find((user) => this.resolveEntityId(user) === senderId);

    if (!fromChatUsers) {
      return directSender;
    }

    return {
      ...fromChatUsers,
      ...directSender
    };
  }

  private resolveEntityId(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      return normalized || null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    const source = value as Record<string, unknown>;
    const direct = source['_id'] ?? source['id'];

    if (typeof direct === 'string' || typeof direct === 'number') {
      const normalized = String(direct).trim();
      return normalized || null;
    }

    if (direct && typeof direct === 'object') {
      const nested = direct as Record<string, unknown>;
      const nestedId = nested['$oid'] ?? nested['_id'] ?? nested['id'];

      if (typeof nestedId === 'string' || typeof nestedId === 'number') {
        const normalized = String(nestedId).trim();
        return normalized || null;
      }
    }

    return null;
  }

  private getOtherUser(chat: Chat): User | null {
    const me = this.currentUserId();

    if (!me) {
      return chat.users?.[0] ?? null;
    }

    for (const user of chat.users ?? []) {
      if (user._id !== me) {
        return user;
      }
    }

    return chat.users?.[0] ?? null;
  }

  private getUserInitials(user: User): string {
    const firstInitial = user.firstName?.trim().charAt(0) ?? user.username?.trim().charAt(0) ?? 'U';
    const lastInitial = user.lastName?.trim().charAt(0) ?? '';

    return `${firstInitial}${lastInitial}`.toUpperCase();
  }

  private getGroupInitials(chat: Chat): string {
    const value = (chat.chatName || 'Group').trim();
    const first = value.charAt(0) || 'G';
    const second = value.charAt(1) || '';

    return `${first}${second}`.toUpperCase();
  }

  private isInvalidAvatarPath(path: string): boolean {
    const normalized = path.trim().toLowerCase();
    return !normalized || normalized === 'null' || normalized === 'undefined';
  }

  private getDisplayImage(path?: string): string {
    if (!path) {
      return '';
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const origin = new URL(environment.apiBaseUrl).origin;
    return `${origin}${path}`;
  }

  private buildInitialsAvatar(initials: string): string {
    const safeInitials = initials.trim() || 'U';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#1f7a66"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">${safeInitials}</text></svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private loadCurrentUser(): void {
    this.authService.me().subscribe({
      next: (user) => {
        this.currentUserId.set(this.resolveEntityId(user));
        this.currentUserEmail.set(user.email ?? null);
        this.recomputeUnreadCounts(this.chats());
      },
      error: () => {
        this.seedCurrentUserFromToken();
      }
    });
  }

  private seedCurrentUserFromToken(): void {
    const token = this.authService.getToken();

    if (!token) {
      return;
    }

    const payload = this.decodeJwtPayload(token);

    if (!payload) {
      return;
    }

    const tokenUserId = this.resolveEntityId(payload['_id'] ?? payload['id'] ?? payload['userId'] ?? payload['sub']);
    const tokenEmail = typeof payload['email'] === 'string' ? payload['email'] : null;

    if (tokenUserId) {
      this.currentUserId.set(tokenUserId);
    }

    if (tokenEmail) {
      this.currentUserEmail.set(tokenEmail);
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');

    if (parts.length < 2) {
      return null;
    }

    const payloadPart = parts[1];

    try {
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const json = atob(padded);
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private recomputeUnreadCounts(chats: Chat[]): void {
    const currentUserId = this.currentUserId();

    if (!currentUserId) {
      return;
    }

    const unreadByChat: Record<string, number> = {};

    for (const chat of chats) {
      const unreadCount = (chat.messages ?? []).filter((message) => {
        const readBy = message.readBy ?? [];
        const senderId = typeof message.sender === 'string' ? message.sender : message.sender?._id;

        if (senderId === currentUserId) {
          return false;
        }

        return !readBy.includes(currentUserId);
      }).length;

      unreadByChat[chat._id] = unreadCount;
    }

    if (this.selectedChatId()) {
      unreadByChat[this.selectedChatId() as string] = 0;
    }

    this.notificationsService.setUnreadMap(unreadByChat);
  }

  private markThreadRead(chatId: string): void {
    this.notificationsService.clearUnreadForChat(chatId);
    this.chatsService.markMessagesAsRead(chatId).subscribe({
      error: () => {
        this.statusMessage.set('Could not sync read state while switching chats.');
      }
    });
  }

  private scrollThreadToBottom(): void {
    requestAnimationFrame(() => {
      const container = this.threadScrollRef()?.nativeElement;

      if (!container) {
        return;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  private tryOpenRequestedChat(): void {
    const requestedChatId = this.requestedChatId();

    if (!requestedChatId || this.selectedChatId() === requestedChatId) {
      return;
    }

    const exists = this.chats().some((chat) => chat._id === requestedChatId);

    if (!exists) {
      return;
    }

    this.selectChat(requestedChatId);
  }
}