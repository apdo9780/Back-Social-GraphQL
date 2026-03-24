import { User } from './user.model';
import { ApiEnvelope } from './user.model';

export interface ChatMessageSummary {
  _id: string;
  sender: User | string;
  readBy?: string[];
}

export interface Chat {
  _id: string;
  chatName: string;
  isGroupChat: boolean;
  users: User[];
  messages?: ChatMessageSummary[];
  unreadCount?: number;
  groupAdmin?: User;
  latestMessage?: {
    _id: string;
    content: string;
    sender: User;
    chat: string;
    createdAt: string;
    updatedAt: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDirectChatPayload {
  userId: string;
}

export interface CreateGroupChatPayload {
  name: string;
  users: string[];
}

export interface RenameGroupChatPayload {
  chatName: string;
}

export interface UpdateGroupUserPayload {
  userId: string;
}

export type ChatResponse = ApiEnvelope<Chat>;
export type ChatsResponse = ApiEnvelope<Chat[]>;
