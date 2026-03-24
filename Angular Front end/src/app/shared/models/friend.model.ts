import { User } from './user.model';
import { ApiEnvelope } from './user.model';

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  _id: string;
  sender: User;
  recipient: User;
  status: FriendRequestStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Friend {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
}

export type FriendRequestsResponse = ApiEnvelope<FriendRequest[]>;
export type FriendsResponse = ApiEnvelope<Friend[]>;
export type FriendRequestMutationResponse = ApiEnvelope<FriendRequest>;
