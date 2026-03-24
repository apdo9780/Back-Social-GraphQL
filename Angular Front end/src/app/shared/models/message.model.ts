import { Chat } from './chat.model';
import { ApiEnvelope } from './user.model';
import { User } from './user.model';

export interface Message {
  _id: string;
  sender: User;
  content: string;
  chat: Chat;
  readBy?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessagePayload {
  content: string;
  chatId: string;
}

export type MessageResponse = ApiEnvelope<Message>;
export type MessagesResponse = ApiEnvelope<Message[]>;
