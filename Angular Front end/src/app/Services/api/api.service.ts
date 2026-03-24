import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

interface ApiRequestOptions {
  params?: HttpParams;
  context?: HttpContext;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string, options?: ApiRequestOptions): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      params: options?.params,
      context: options?.context
    });
  }

  post<T, TBody>(path: string, body: TBody, options?: ApiRequestOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      context: options?.context
    });
  }

  put<T, TBody>(path: string, body?: TBody, options?: ApiRequestOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body ?? {}, {
      context: options?.context
    });
  }

  delete<T>(path: string, options?: ApiRequestOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      context: options?.context
    });
  }
}
