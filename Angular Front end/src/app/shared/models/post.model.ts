import { User } from './user.model';

export interface PostComment {
  _id: string;
  user: User | string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Post {
  _id: string;
  author: User;
  content: string;
  media?: string[];
  privacy?: 'public' | 'private' | 'friends';
  tags?: string[];
  likes: Array<string | User>;
  comments: PostComment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePostPayload {
  content: string;
  privacy?: 'public' | 'private' | 'friends';
  tags?: string[];
  imageFile?: File | null;
}

export interface UpdatePostPayload {
  content: string;
  privacy?: 'public' | 'private' | 'friends';
  tags?: string[];
  imageFile?: File | null;
}

export interface AddCommentPayload {
  content: string;
}

export interface PostsResponse {
  success: boolean;
  count: number;
  data: Post[];
}

export interface PostResponse {
  success: boolean;
  data: Post;
}
