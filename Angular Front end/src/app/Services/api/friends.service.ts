import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiService } from './api.service';
import { SocketService } from '../socket/socket.service';
import {
  Friend,
  FriendRequest,
  FriendRequestMutationResponse,
  FriendRequestsResponse,
  FriendsResponse
} from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class FriendsService {
  private readonly api = inject(ApiService);
  private readonly socketService = inject(SocketService);

  getFriendRequests(): Observable<FriendRequest[]> {
    return this.api
      .get<FriendRequestsResponse>('/friends/requests')
      .pipe(map((response) => response.data));
  }

  getFriends(): Observable<Friend[]> {
    return this.api
      .get<FriendsResponse>('/friends')
      .pipe(map((response) => response.data));
  }

  sendFriendRequest(userId: string): Observable<FriendRequest> {
    return this.api
      .post<FriendRequestMutationResponse, Record<string, never>>(`/friends/request/${userId}`, {})
      .pipe(map((response) => response.data));
  }

  acceptFriendRequest(requestId: string): Observable<FriendRequest> {
    return this.api
      .put<FriendRequestMutationResponse, Record<string, never>>(`/friends/accept/${requestId}`, {})
      .pipe(
        map((response) => {
          const senderId = response.data.sender?._id;

          if (senderId) {
            this.socketService.emit('friend_request_response', {
              userId: senderId,
              status: 'accepted'
            });
          }

          return response.data;
        })
      );
  }

  rejectFriendRequest(requestId: string): Observable<FriendRequest> {
    return this.api
      .put<FriendRequestMutationResponse, Record<string, never>>(`/friends/reject/${requestId}`, {})
      .pipe(
        map((response) => {
          const senderId = response.data.sender?._id;

          if (senderId) {
            this.socketService.emit('friend_request_response', {
              userId: senderId,
              status: 'rejected'
            });
          }

          return response.data;
        })
      );
  }

  removeFriend(friendId: string): Observable<void> {
    return this.api.delete<void>(`/friends/${friendId}`);
  }
}