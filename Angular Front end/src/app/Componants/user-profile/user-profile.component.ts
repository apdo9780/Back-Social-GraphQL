import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { ChatsService } from '../../Services/api/chats.service';
import { FriendsService } from '../../Services/api/friends.service';
import { PostsService } from '../../Services/api/posts.service';
import { AuthService } from '../../Services/auth/auth.service';
import { Post, PostComment, User } from '../../shared/models';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly postsService = inject(PostsService);
  private readonly chatsService = inject(ChatsService);
  private readonly friendsService = inject(FriendsService);

  protected readonly viewedUser = signal<User | null>(null);
  protected readonly currentUser = signal<User | null>(null);
  protected readonly userPosts = signal<Post[]>([]);
  protected readonly friendIds = signal<string[]>([]);
  protected readonly statusMessage = signal('');
  protected readonly statusType = signal<'success' | 'error' | 'info'>('info');
  protected readonly isLoadingPage = signal(false);
  protected readonly isLoadingPosts = signal(false);
  protected commentDrafts: Record<string, string> = {};

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const userId = params.get('id');

      if (!userId) {
        this.statusType.set('error');
        this.statusMessage.set('Invalid user profile route.');
        return;
      }

      this.loadPage(userId);
    });
  }

  protected loadPage(userId: string): void {
    this.viewedUser.set(null);
    this.userPosts.set([]);
    this.statusMessage.set('');

    this.isLoadingPage.set(true);
    this.authService
      .me()
      .pipe(finalize(() => this.isLoadingPage.set(false)))
      .subscribe({
        next: (me) => {
          this.currentUser.set(me);
          this.loadFriends();
          this.loadViewedUser(userId);
          this.loadUserPosts(userId);
        },
        error: () => {
          this.statusType.set('error');
          this.statusMessage.set('Could not load session user.');
        }
      });
  }

  protected sendFriendRequest(): void {
    const userId = this.viewedUser()?._id;
    if (!userId || !this.canSendFriendRequest()) {
      return;
    }

    this.friendsService.sendFriendRequest(userId).subscribe({
      next: () => {
        this.statusType.set('success');
        this.statusMessage.set('Friend request sent.');
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not send friend request.');
      }
    });
  }

  protected messageUser(): void {
    const userId = this.viewedUser()?._id;
    if (!userId || !this.canMessageUser()) {
      return;
    }

    this.chatsService.accessDirectChat({ userId }).subscribe({
      next: (chat) => {
        void this.router.navigate(['/chats'], {
          queryParams: { chatId: chat._id }
        });
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not start a chat with this user.');
      }
    });
  }

  protected toggleLike(postId: string): void {
    this.postsService.like(postId).subscribe({
      next: (updatedPost) => {
        this.userPosts.update((posts) => posts.map((post) => (post._id === updatedPost._id ? updatedPost : post)));
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

  protected getCommentAuthorId(comment: PostComment): string | null {
    if (typeof comment.user === 'string') {
      return comment.user;
    }

    return comment.user._id;
  }

  protected openCommentAuthorProfile(comment: PostComment): void {
    const userId = this.getCommentAuthorId(comment);
    if (!userId) {
      return;
    }

    this.openUserProfile(userId);
  }

  protected canMessageCommentUser(comment: PostComment): boolean {
    const userId = this.getCommentAuthorId(comment);
    return !!userId && this.currentUser()?._id !== userId;
  }

  protected canSendFriendRequestToCommentUser(comment: PostComment): boolean {
    const userId = this.getCommentAuthorId(comment);

    if (!userId || this.currentUser()?._id === userId) {
      return false;
    }

    return !this.friendIds().includes(userId);
  }

  protected messageCommentAuthor(comment: PostComment): void {
    const userId = this.getCommentAuthorId(comment);
    if (!userId || !this.canMessageCommentUser(comment)) {
      return;
    }

    this.chatsService.accessDirectChat({ userId }).subscribe({
      next: (chat) => {
        void this.router.navigate(['/chats'], {
          queryParams: { chatId: chat._id }
        });
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not start a chat with this user.');
      }
    });
  }

  protected sendFriendRequestToCommentAuthor(comment: PostComment): void {
    const userId = this.getCommentAuthorId(comment);
    if (!userId || !this.canSendFriendRequestToCommentUser(comment)) {
      return;
    }

    this.friendsService.sendFriendRequest(userId).subscribe({
      next: () => {
        this.statusType.set('success');
        this.statusMessage.set('Friend request sent.');
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not send friend request.');
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
        this.userPosts.update((posts) => posts.map((post) => (post._id === updatedPost._id ? updatedPost : post)));
      }
    });
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

  protected avatarUrl(): string {
    return this.getUserAvatar(this.viewedUser());
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

  protected isOwnProfile(): boolean {
    return this.currentUser()?._id === this.viewedUser()?._id;
  }

  protected canMessageUser(): boolean {
    return !this.isOwnProfile();
  }

  protected canSendFriendRequest(): boolean {
    const viewedId = this.viewedUser()?._id;

    if (!viewedId || this.isOwnProfile()) {
      return false;
    }

    return !this.friendIds().includes(viewedId);
  }

  protected hasLiked(post: Post): boolean {
    const me = this.currentUser()?._id;
    if (!me) {
      return false;
    }

    return post.likes.some((like) => (typeof like === 'string' ? like : like._id) === me);
  }

  private loadViewedUser(userId: string): void {
    this.authService.getFriendProfile(userId).subscribe({
      next: (user) => {
        this.viewedUser.set(user);
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not load this user profile.');
      }
    });
  }

  private loadUserPosts(userId: string): void {
    this.isLoadingPosts.set(true);
    this.postsService.getByUser(userId).pipe(finalize(() => this.isLoadingPosts.set(false))).subscribe({
      next: (posts) => {
        this.userPosts.set(posts);
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not load user posts.');
      }
    });
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
}
