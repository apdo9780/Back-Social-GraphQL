import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { FriendsService } from '../../Services/api/friends.service';
import { ChatsService } from '../../Services/api/chats.service';
import { AuthService } from '../../Services/auth/auth.service';
import { NotificationsService } from '../../Services/socket/notifications.service';
import { Friend, FriendRequest, User } from '../../shared/models';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.scss'
})
export class FriendsComponent {
  private readonly friendsService = inject(FriendsService);
  private readonly chatsService = inject(ChatsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly notificationsService = inject(NotificationsService);

  protected readonly isLoading = signal(false);
  protected readonly isSearching = signal(false);
  protected readonly actionMessage = signal('');
  protected readonly friends = signal<Friend[]>([]);
  protected readonly requests = signal<FriendRequest[]>([]);
  protected readonly searchResults = signal<User[]>([]);
  protected readonly currentUserId = signal<string | null>(null);
  protected readonly sentRequestUserIds = signal<string[]>([]);

  protected readonly searchForm = this.formBuilder.nonNullable.group({
    query: ['', [Validators.required, Validators.minLength(2)]]
  });

  constructor() {
    this.loadData();
  }

  protected loadData(): void {
    this.isLoading.set(true);
    this.actionMessage.set('');

    this.authService.meSummary().subscribe({
      next: (summary) => {
        this.currentUserId.set(summary.data._id);
        const sentRequestIds = (summary.SentFriendsRequestsUsersData ?? []).map((user) => user._id);
        this.sentRequestUserIds.set(sentRequestIds);
      },
      error: () => {
        this.currentUserId.set(null);
        this.sentRequestUserIds.set([]);
      }
    });

    this.friendsService
      .getFriends()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (friends) => {
          this.friends.set(friends);
        },
        error: () => {
          this.actionMessage.set('Unable to load friends list.');
        }
      });

    this.friendsService.getFriendRequests().subscribe({
      next: (requests) => {
        this.requests.set(requests);
        this.notificationsService.setPendingFriendRequestsCount(requests.length);
      },
      error: () => {
        this.actionMessage.set('Unable to load friend requests.');
      }
    });
  }

  protected searchUsers(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    const query = this.searchForm.getRawValue().query.trim();

    if (query.length < 2) {
      return;
    }

    this.isSearching.set(true);
    this.authService
      .searchUsers(query)
      .pipe(finalize(() => this.isSearching.set(false)))
      .subscribe({
        next: (users) => {
          this.searchResults.set(users);
          if (users.length === 0) {
            this.actionMessage.set('No users found for this search.');
          }
        },
        error: () => {
          this.actionMessage.set('Unable to search users right now.');
          this.searchResults.set([]);
        }
      });
  }

  protected openProfile(userId: string): void {
    void this.router.navigate(['/users', userId]);
  }

  protected messageUser(userId: string): void {
    if (this.currentUserId() === userId) {
      return;
    }

    this.chatsService.accessDirectChat({ userId }).subscribe({
      next: (chat) => {
        void this.router.navigate(['/chats'], {
          queryParams: { chatId: chat._id }
        });
      },
      error: () => {
        this.actionMessage.set('Could not open chat with this user.');
      }
    });
  }

  protected canSendRequest(userId: string): boolean {
    if (this.currentUserId() === userId) {
      return false;
    }

    const alreadyFriend = this.friends().some((friend) => friend._id === userId);
    const alreadyRequested = this.sentRequestUserIds().includes(userId);

    return !alreadyFriend && !alreadyRequested;
  }

  protected sendRequestToUser(userId: string): void {
    if (!this.canSendRequest(userId)) {
      return;
    }

    this.friendsService.sendFriendRequest(userId).subscribe({
      next: () => {
        this.actionMessage.set('Friend request sent successfully.');
        this.sentRequestUserIds.update((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
      },
      error: (error: { error?: { error?: string } }) => {
        this.actionMessage.set(error.error?.error ?? 'Failed to send friend request.');
      }
    });
  }

  protected acceptRequest(requestId: string): void {
    this.friendsService.acceptFriendRequest(requestId).subscribe({
      next: () => {
        this.actionMessage.set('Friend request accepted.');
        this.notificationsService.decrementPendingFriendRequests();
        this.loadData();
      },
      error: (error: { error?: { error?: string } }) => {
        this.actionMessage.set(error.error?.error ?? 'Failed to accept request.');
      }
    });
  }

  protected rejectRequest(requestId: string): void {
    this.friendsService.rejectFriendRequest(requestId).subscribe({
      next: () => {
        this.actionMessage.set('Friend request rejected.');
        this.notificationsService.decrementPendingFriendRequests();
        this.loadData();
      },
      error: (error: { error?: { error?: string } }) => {
        this.actionMessage.set(error.error?.error ?? 'Failed to reject request.');
      }
    });
  }

  protected removeFriend(friendId: string): void {
    this.friendsService.removeFriend(friendId).subscribe({
      next: () => {
        this.actionMessage.set('Friend removed.');
        this.loadData();
      },
      error: (error: { error?: { error?: string } }) => {
        this.actionMessage.set(error.error?.error ?? 'Failed to remove friend.');
      }
    });
  }

  protected presenceOf(userId: string): string {
    return this.notificationsService.getPresence(userId);
  }

  protected fullName(user: User): string {
    const first = user.firstName?.trim() ?? '';
    const last = user.lastName?.trim() ?? '';
    return `${first} ${last}`.trim();
  }
}