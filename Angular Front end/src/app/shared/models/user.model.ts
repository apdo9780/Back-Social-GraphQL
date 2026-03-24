export interface User {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  role?: 'user' | 'admin';
  avatar?: string;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface UpdateUserPayload {
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  email?: string;
  password: string;
  newPassword?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface MeResponse {
  success: boolean;
  data: User;
  SentFriendsRequestsUsersData?: User[];
}
