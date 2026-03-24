import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { PostsService } from '../../Services/api/posts.service';
import { Post, User } from '../../shared/models';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './posts.component.html',
  styleUrl: './posts.component.scss'
})
export class PostsComponent {
  private readonly postsService = inject(PostsService);
  private readonly router = inject(Router);

  protected readonly myPosts = signal<Post[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly isPostImageDragOver = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusType = signal<'success' | 'error' | 'info'>('info');

  protected newPostContent = '';
  protected newPostPrivacy: 'public' | 'private' | 'friends' = 'public';
  protected newPostTags = '';
  protected selectedImageFile: File | null = null;
  protected commentDrafts: Record<string, string> = {};

  constructor() {
    this.fetchMine();
  }

  protected fetchMine(): void {
    this.isLoading.set(true);
    this.postsService.getMine().pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: (posts) => {
        this.myPosts.set(posts);
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not load your posts.');
      }
    });
  }

  protected onPostImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setPostImageFile(input.files?.[0] ?? null);
  }

  protected onPostImageDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isPostImageDragOver.set(true);
  }

  protected onPostImageDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isPostImageDragOver.set(false);
  }

  protected onPostImageDrop(event: DragEvent): void {
    event.preventDefault();
    this.isPostImageDragOver.set(false);
    const droppedFile = event.dataTransfer?.files?.[0] ?? null;
    this.setPostImageFile(droppedFile);
  }

  protected triggerPostImagePicker(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  protected onPostDropZoneKeydown(event: KeyboardEvent, fileInput: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.triggerPostImagePicker(fileInput);
    }
  }

  protected createPost(): void {
    if (!this.newPostContent.trim()) {
      return;
    }

    this.isSubmitting.set(true);
    this.postsService
      .create({
        content: this.newPostContent.trim(),
        privacy: this.newPostPrivacy,
        tags: this.newPostTags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        imageFile: this.selectedImageFile
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (post) => {
          this.newPostContent = '';
          this.newPostTags = '';
          this.newPostPrivacy = 'public';
          this.selectedImageFile = null;
          this.myPosts.update((posts) => [post, ...posts]);
          this.statusType.set('success');
          this.statusMessage.set('Post created successfully.');
        },
        error: () => {
          this.statusType.set('error');
          this.statusMessage.set('Failed to create post.');
        }
      });
  }

  protected toggleLike(postId: string): void {
    this.postsService.like(postId).subscribe({
      next: (updatedPost) => {
        this.replacePostInLists(updatedPost);
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Could not update like.');
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
        this.replacePostInLists(updatedPost);
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Failed to add comment.');
      }
    });
  }

  protected deletePost(postId: string): void {
    this.postsService.remove(postId).subscribe({
      next: () => {
        this.myPosts.update((posts) => posts.filter((post) => post._id !== postId));
        this.statusType.set('success');
        this.statusMessage.set('Post removed.');
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Failed to remove post.');
      }
    });
  }

  protected openUserProfile(userId: string): void {
    void this.router.navigate(['/users', userId]);
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

  protected getUserAvatar(user: User | null | undefined): string {
    if (!user) {
      return this.buildInitialsAvatar('U');
    }

    if (!user.avatar || this.isInvalidAvatarPath(user.avatar)) {
      return this.buildInitialsAvatar(this.getUserInitials(user));
    }

    return this.getDisplayImage(user.avatar);
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

  protected canDelete(post: Post): boolean {
    return true;
  }

  protected hasLiked(post: Post): boolean {
    const me = post.author?._id;
    if (!me) {
      return false;
    }

    return post.likes.some((like) => this.toUserId(like) === me);
  }

  private toUserId(like: string | User): string {
    if (typeof like === 'string') {
      return like;
    }

    return like._id;
  }

  private replacePostInLists(updatedPost: Post): void {
    this.myPosts.update((posts) =>
      posts.map((post) => (post._id === updatedPost._id ? this.mergePostForDisplay(post, updatedPost) : post))
    );
  }

  private mergePostForDisplay(existingPost: Post, updatedPost: Post): Post {
    const knownLikeUsers = new Map<string, User>();

    for (const like of existingPost.likes) {
      if (typeof like !== 'string') {
        knownLikeUsers.set(like._id, like);
      }
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

  private setPostImageFile(file: File | null): void {
    if (!file || !file.type.startsWith('image/')) {
      this.selectedImageFile = null;
      return;
    }

    this.selectedImageFile = file;
  }
}
