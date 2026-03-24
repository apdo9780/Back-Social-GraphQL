import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../Services/auth/auth.service';
import { ChatsService } from '../../Services/api/chats.service';
import { FriendsService } from '../../Services/api/friends.service';
import { PostsService } from '../../Services/api/posts.service';
import { SocketService } from '../../Services/socket/socket.service';
import { Post, PostComment, User } from '../../shared/models';

interface PostUpdatedPayload {
  type: 'like' | 'comment';
  postId: string;
  actorId?: string;
  actorName?: string;
  post?: Post;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private readonly authService = inject(AuthService);
  private readonly postsService = inject(PostsService);
  private readonly socketService = inject(SocketService);
  private readonly chatsService = inject(ChatsService);
  private readonly friendsService = inject(FriendsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly isLoadingFeed = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusType = signal<'success' | 'error' | 'info'>('info');
  protected readonly currentUser = signal<User | null>(null);
  protected readonly feedPosts = signal<Post[]>([]);
  protected readonly friendIds = signal<string[]>([]);
  protected readonly highlightedPostId = signal<string | null>(null);
  protected readonly highlightedCommentId = signal<string | null>(null);
  protected commentDrafts: Record<string, string> = {};
  protected collapsedCommentsByPost: Record<string, boolean> = {};
  protected likesExpandedByPost: Record<string, boolean> = {};

  constructor() {
    this.bindActivityNavigation();
    this.bindPostRealtimeUpdates();
    this.loadDashboard();
  }

  protected loadDashboard(): void {
    this.isLoading.set(true);

    this.authService
      .me()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (user) => {
          this.currentUser.set(user);
          this.loadFriends();
          this.loadFeed();
          this.statusMessage.set('Global feed loaded.');
          this.statusType.set('success');
        },
        error: (error: { error?: { error?: string } }) => {
          this.statusMessage.set(error.error?.error ?? 'Unable to load dashboard data with current token.');
          this.statusType.set('error');
        }
      });
  }

  protected loadFeed(): void {
    this.isLoadingFeed.set(true);
    this.postsService
      .getFeed()
      .pipe(finalize(() => this.isLoadingFeed.set(false)))
      .subscribe({
        next: (posts) => {
          this.feedPosts.set(posts);
        },
        error: () => {
          this.statusMessage.set('Unable to load global feed.');
          this.statusType.set('error');
        }
      });
  }

  protected openUserProfile(userId: string): void {
    void this.router.navigate(['/users', userId]);
  }

  protected getCommentAuthorName(comment: PostComment): string {
    if (typeof comment.user === 'string') {
      return 'User';
    }

    return comment.user.username;
  }

  protected getUserAvatar(user: User | null | undefined): string {
    if (!user) {
      return this.buildInitialsAvatar('U');
    }

    if (!user.avatar || this.isInvalidAvatarPath(user.avatar)) {
      return this.buildInitialsAvatar(this.getUserInitials(user));
    }

    return this.getDisplayImage(user.avatar);
  }

  protected getCommentAuthorAvatar(comment: PostComment): string {
    if (typeof comment.user === 'string') {
      return this.buildInitialsAvatar('U');
    }

    return this.getUserAvatar(comment.user);
  }

  protected onAvatarError(event: Event, user?: User | null): void {
    const target = event.target as HTMLImageElement | null;

    if (!target) {
      return;
    }

    const initials = user ? this.getUserInitials(user) : 'U';
    const fallback = this.buildInitialsAvatar(initials);

    if (target.src !== fallback) {
      target.src = fallback;
    }
  }

  private getUserInitials(user: User): string {
    const firstInitial = user.firstName?.trim().charAt(0) ?? user.username?.trim().charAt(0) ?? 'U';
    const lastInitial = user.lastName?.trim().charAt(0) ?? '';

    return `${firstInitial}${lastInitial}`.toUpperCase();
  }

  private isInvalidAvatarPath(path: string): boolean {
    const normalized = path.trim().toLowerCase();
    return !normalized || normalized === 'null' || normalized === 'undefined';
  }

  private buildInitialsAvatar(initials: string): string {
    const safeInitials = initials.trim() || 'U';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#1f7a66"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">${safeInitials}</text></svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  protected getCommentAuthorId(comment: PostComment): string | null {
    if (typeof comment.user === 'string') {
      return comment.user;
    }

    return comment.user._id;
  }

  protected startMessage(userId: string): void {
    if (!this.canMessageUser(userId)) {
      return;
    }

    this.chatsService.accessDirectChat({ userId }).subscribe({
      next: (chat) => {
        void this.router.navigate(['/chats'], {
          queryParams: { chatId: chat._id }
        });
      },
      error: () => {
        this.statusMessage.set('Unable to start chat with this user.');
        this.statusType.set('error');
      }
    });
  }

  protected sendFriendRequest(userId: string): void {
    if (!this.canSendFriendRequestTo(userId)) {
      return;
    }

    this.friendsService.sendFriendRequest(userId).subscribe({
      next: () => {
        this.statusMessage.set('Friend request sent.');
        this.statusType.set('success');
      },
      error: () => {
        this.statusMessage.set('Unable to send friend request.');
        this.statusType.set('error');
      }
    });
  }

  protected toggleLike(postId: string): void {
    this.postsService.like(postId).subscribe({
      next: (updatedPost) => {
        this.feedPosts.update((posts) =>
          posts.map((post) =>
            post._id === updatedPost._id ? this.mergePostForDisplay(post, updatedPost) : post
          )
        );
      }
    });
  }

  protected submitComment(postId: string): void {
    const content = this.commentDrafts[postId]?.trim();

    if (!content) {
      return;
    }

    this.postsService.addComment(postId, { content }).subscribe({
      next: (updatedPost) => {
        this.commentDrafts[postId] = '';
        this.feedPosts.update((posts) =>
          posts.map((post) =>
            post._id === updatedPost._id ? this.mergePostForDisplay(post, updatedPost) : post
          )
        );
      }
    });
  }

  protected toggleCommentsSection(postId: string): void {
    this.collapsedCommentsByPost[postId] = !this.isCommentsSectionCollapsed(postId);
  }

  protected isCommentsSectionCollapsed(postId: string): boolean {
    return this.collapsedCommentsByPost[postId] ?? false;
  }

  protected toggleLikesPanel(postId: string): void {
    this.likesExpandedByPost[postId] = !this.isLikesPanelOpen(postId);
  }

  protected isLikesPanelOpen(postId: string): boolean {
    return this.likesExpandedByPost[postId] ?? false;
  }

  protected getLikeDisplayName(like: string | User): string {
    if (typeof like === 'string') {
      const me = this.currentUser();
      if (me?._id === like) {
        return `@${me.username}`;
      }

      return '@unknown';
    }

    return `@${like.username}`;
  }

  protected canOpenLikeProfile(like: string | User): boolean {
    return typeof like !== 'string' && !!like._id;
  }

  protected openLikeProfile(like: string | User): void {
    if (typeof like === 'string' || !like._id) {
      return;
    }

    this.openUserProfile(like._id);
  }

  protected getDisplayImage(path?: string): string {
    if (!path) {
      return '';
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    return `http://localhost:5000${path}`;
  }

  protected hasLiked(post: Post): boolean {
    const me = this.currentUser()?._id;
    if (!me) {
      return false;
    }

    return post.likes.some((like) => (typeof like === 'string' ? like : like._id) === me);
  }

  protected canMessageUser(userId: string): boolean {
    return this.currentUser()?._id !== userId;
  }

  protected canMessageCommentUser(comment: PostComment): boolean {
    const userId = this.getCommentAuthorId(comment);
    return !!userId && this.canMessageUser(userId);
  }

  protected canSendFriendRequestTo(userId: string): boolean {
    if (this.currentUser()?._id === userId) {
      return false;
    }

    return !this.friendIds().includes(userId);
  }

  protected canSendFriendRequestToCommentUser(comment: PostComment): boolean {
    const userId = this.getCommentAuthorId(comment);
    return !!userId && this.canSendFriendRequestTo(userId);
  }

  protected openCommentAuthorProfile(comment: PostComment): void {
    const userId = this.getCommentAuthorId(comment);
    if (!userId) {
      return;
    }

    this.openUserProfile(userId);
  }

  protected messageCommentAuthor(comment: PostComment): void {
    const userId = this.getCommentAuthorId(comment);
    if (!userId) {
      return;
    }

    this.startMessage(userId);
  }

  protected sendFriendRequestToCommentAuthor(comment: PostComment): void {
    const userId = this.getCommentAuthorId(comment);
    if (!userId) {
      return;
    }

    this.sendFriendRequest(userId);
  }

  protected isOwnPost(post: Post): boolean {
    return this.currentUser()?._id === post.author?._id;
  }

  private loadFriends(): void {
    this.friendsService.getFriends().subscribe({
      next: (friends) => {
        this.friendIds.set(friends.map((friend) => friend._id));
      },
      error: () => {
        this.friendIds.set([]);
      }
    });
  }

  private mergePostForDisplay(existingPost: Post, updatedPost: Post): Post {
    const knownLikeUsers = new Map<string, User>();

    for (const like of existingPost.likes) {
      if (typeof like !== 'string') {
        knownLikeUsers.set(like._id, like);
      }
    }

    const me = this.currentUser();
    if (me?._id) {
      knownLikeUsers.set(me._id, me);
    }

    const mergedLikes = updatedPost.likes.map((like) => {
      if (typeof like !== 'string') {
        return like;
      }

      return knownLikeUsers.get(like) ?? like;
    });

    return {
      ...updatedPost,
      likes: mergedLikes
    };
  }

  protected isPostHighlighted(postId: string): boolean {
    return this.highlightedPostId() === postId;
  }

  protected isCommentHighlighted(commentId?: string): boolean {
    if (!commentId) {
      return false;
    }

    return this.highlightedCommentId() === commentId;
  }

  private bindActivityNavigation(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const postId = params.get('postId');
      const commentId = params.get('commentId');

      if (!postId) {
        return;
      }

      this.highlightedPostId.set(postId);
      this.highlightedCommentId.set(commentId);

      if (commentId) {
        this.collapsedCommentsByPost[postId] = false;
      }

      setTimeout(() => {
        const selector = commentId ? `[data-comment-id="${commentId}"]` : `[data-post-id="${postId}"]`;
        const target = document.querySelector(selector);

        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 220);
    });
  }

  private bindPostRealtimeUpdates(): void {
    this.socketService.connect();

    this.socketService
      .on<PostUpdatedPayload>('post_updated')
      .pipe(takeUntilDestroyed())
      .subscribe((payload) => {
        if (!payload.post || !payload.postId) {
          return;
        }

        this.feedPosts.update((posts) =>
          posts.map((post) => (post._id === payload.postId ? this.mergePostForDisplay(post, payload.post as Post) : post))
        );
      });
  }

}
