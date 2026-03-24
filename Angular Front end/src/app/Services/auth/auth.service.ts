import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import {
  ApiEnvelope,
  AuthResponse,
  LoginCredentials,
  MeResponse,
  RegisterData,
  UpdateUserPayload,
  User
} from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenStorageKey = 'social_app_token';
  private readonly api = inject(ApiService);

  login(payload: LoginCredentials): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse, LoginCredentials>('/auth/login', payload)
      .pipe(tap((response) => this.setToken(response.token)));
  }

  register(payload: RegisterData): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse, RegisterData>('/auth/register', payload)
      .pipe(tap((response) => this.setToken(response.token)));
  }

  me(): Observable<User> {
    return this.api
      .get<MeResponse>('/auth/me')
      .pipe(map((response) => response.data));
  }

  meSummary(): Observable<MeResponse> {
    return this.api.get<MeResponse>('/auth/me');
  }

  searchUsers(term: string): Observable<User[]> {
    const encoded = encodeURIComponent(term.trim());

    return this.api
      .get<ApiEnvelope<User[]>>(`/auth/search?q=${encoded}`)
      .pipe(map((response) => response.data));
  }

  getFriendProfile(friendId: string): Observable<User> {
    return this.api
      .get<ApiEnvelope<User>>(`/auth/friend/${friendId}`)
      .pipe(map((response) => response.data));
  }

  updateDetails(payload: UpdateUserPayload): Observable<string> {
    return this.api
      .put<ApiEnvelope<string>, UpdateUserPayload>('/auth/updatedetails', payload)
      .pipe(map((response) => response.data));
  }

  uploadAvatar(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.api
      .put<ApiEnvelope<User>, FormData>('/auth/avatar', formData)
      .pipe(map((response) => response.data));
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  logout(): void {
    localStorage.removeItem(this.tokenStorageKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenStorageKey, token);
  }
}
