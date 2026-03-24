import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { SKIP_GLOBAL_LOADING } from '../../Interceptors/loading.interceptor';
import { ApiService } from './api.service';
import {
  Chat,
  ChatResponse,
  ChatsResponse,
  CreateDirectChatPayload,
  Message,
  MessageResponse,
  MessagesResponse,
  SendMessagePayload
} from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class ChatsService {
  private readonly api = inject(ApiService);

  getChats(): Observable<Chat[]> {
    return this.api.get<ChatsResponse>('/chats').pipe(map((response) => response.data));
  }

  accessDirectChat(payload: CreateDirectChatPayload): Observable<Chat> {
    return this.api
      .post<ChatResponse, CreateDirectChatPayload>('/chats', payload)
      .pipe(map((response) => response.data));
  }

  getMessages(chatId: string): Observable<Message[]> {
    return this.api
      .get<MessagesResponse>(`/messages/${chatId}`)
      .pipe(map((response) => response.data));
  }

  sendMessage(payload: SendMessagePayload): Observable<Message> {
    return this.api
      .post<MessageResponse, SendMessagePayload>('/messages', payload, {
        context: new HttpContext().set(SKIP_GLOBAL_LOADING, true)
      })
      .pipe(map((response) => response.data));
  }

  markMessagesAsRead(chatId: string): Observable<void> {
    return this.api.put<void, Record<string, never>>(`/messages/${chatId}/read`, {});
  }
}