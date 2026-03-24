import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiService } from './api.service';
import {
  AddCommentPayload,
  CreatePostPayload,
  Post,
  PostResponse,
  PostsResponse,
  UpdatePostPayload
} from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class PostsService {
  private readonly api = inject(ApiService);

  getFeed(): Observable<Post[]> {
    return this.api.get<PostsResponse>('/posts').pipe(map((response) => response.data));
  }

  getMine(): Observable<Post[]> {
    return this.api.get<PostsResponse>('/posts/mine').pipe(map((response) => response.data));
  }

  getByUser(userId: string): Observable<Post[]> {
    return this.api.get<PostsResponse>(`/posts/user/${userId}`).pipe(map((response) => response.data));
  }

  create(payload: CreatePostPayload): Observable<Post> {
    const body = this.buildPostFormData(payload);
    return this.api.post<PostResponse, FormData>('/posts', body).pipe(map((response) => response.data));
  }

  update(postId: string, payload: UpdatePostPayload): Observable<Post> {
    const body = this.buildPostFormData(payload);
    return this.api.put<PostResponse, FormData>(`/posts/${postId}`, body).pipe(map((response) => response.data));
  }

  like(postId: string): Observable<Post> {
    return this.api.put<PostResponse, Record<string, never>>(`/posts/${postId}/like`, {}).pipe(map((response) => response.data));
  }

  addComment(postId: string, payload: AddCommentPayload): Observable<Post> {
    return this.api.post<PostResponse, AddCommentPayload>(`/posts/${postId}/comments`, payload).pipe(map((response) => response.data));
  }

  remove(postId: string): Observable<void> {
    return this.api.delete<void>(`/posts/${postId}`);
  }

  private buildPostFormData(payload: CreatePostPayload | UpdatePostPayload): FormData {
    const formData = new FormData();
    formData.append('content', payload.content);

    if (payload.privacy) {
      formData.append('privacy', payload.privacy);
    }

    if (payload.tags && payload.tags.length > 0) {
      formData.append('tags', payload.tags.join(','));
    }

    if (payload.imageFile) {
      formData.append('image', payload.imageFile);
    }

    return formData;
  }
}
