import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../Services/auth/auth.service';
import { AppNotification, AppToast } from '../../Services/socket/notifications.service';
import { NotificationsService } from '../../Services/socket/notifications.service';
import { SocketService } from '../../Services/socket/socket.service';
import { ThemeService } from '../../Services/theme/theme.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationsService = inject(NotificationsService);
  private readonly socketService = inject(SocketService);
  private readonly themeService = inject(ThemeService);

  protected readonly showNotifications = signal(false);
  protected readonly notifications = this.notificationsService.notifications;
  protected readonly toasts = this.notificationsService.toasts;
  protected readonly unreadCount = this.notificationsService.unreadCount;
  protected readonly unreadChatsTotal = this.notificationsService.unreadChatsTotal;
  protected readonly pendingFriendRequests = this.notificationsService.pendingFriendRequests;
  protected readonly isSocketConnected = this.socketService.isConnected;
  protected readonly isDarkMode = this.themeService.isDarkMode;

  ngOnInit(): void {
    this.themeService.initialize();
    this.notificationsService.initialize();
  }

  ngOnDestroy(): void {
    this.notificationsService.destroy();
    this.socketService.disconnect();
  }

  protected toggleNotifications(): void {
    this.showNotifications.update((isOpen) => !isOpen);

    if (this.showNotifications()) {
      this.notificationsService.markAllAsRead();
    }
  }

  protected dismissToast(toastId: string): void {
    this.notificationsService.dismissToast(toastId);
  }

  protected openToastTarget(toast: AppToast): void {
    if (!toast.target?.route) {
      return;
    }

    void this.router.navigate([toast.target.route], {
      queryParams: toast.target.queryParams
    });

    this.notificationsService.dismissToast(toast.id);
  }

  protected dismissToastFromEvent(event: Event, toastId: string): void {
    event.stopPropagation();
    this.dismissToast(toastId);
  }

  protected openNotificationTarget(notification: AppNotification): void {
    if (!notification.target?.route) {
      return;
    }

    void this.router.navigate([notification.target.route], {
      queryParams: notification.target.queryParams
    });

    this.showNotifications.set(false);
  }

  protected canOpenNotification(notification: AppNotification): boolean {
    return notification.kind === 'message' || notification.kind === 'friend' || notification.kind === 'post';
  }

  protected toggleTheme(): void {
    this.themeService.toggleMode();
  }

  protected logout(): void {
    this.notificationsService.destroy();
    this.socketService.disconnect();
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}