import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../Services/auth/auth.service';
import { User } from '../../shared/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private readonly authService = inject(AuthService);

  protected readonly user = signal<User | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly isAvatarDragOver = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusType = signal<'success' | 'error' | 'info'>('info');

  protected username = '';
  protected firstName = '';
  protected lastName = '';
  protected email = '';
  protected bio = '';
  protected currentPassword = '';
  protected newPassword = '';
  protected selectedAvatarFile: File | null = null;

  constructor() {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.isLoading.set(true);

    this.authService
      .me()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.username = user.username;
          this.firstName = user.firstName ?? '';
          this.lastName = user.lastName ?? '';
          this.email = user.email;
          this.bio = user.bio ?? '';
        },
        error: () => {
          this.statusType.set('error');
          this.statusMessage.set('Could not load your profile.');
        }
      });
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setAvatarFile(input.files?.[0] ?? null);
  }

  protected onAvatarDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isAvatarDragOver.set(true);
  }

  protected onAvatarDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isAvatarDragOver.set(false);
  }

  protected onAvatarDrop(event: DragEvent): void {
    event.preventDefault();
    this.isAvatarDragOver.set(false);
    const droppedFile = event.dataTransfer?.files?.[0] ?? null;
    this.setAvatarFile(droppedFile);
  }

  protected triggerAvatarFilePicker(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  protected onDropZoneKeydown(event: KeyboardEvent, fileInput: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.triggerAvatarFilePicker(fileInput);
    }
  }

  protected saveProfile(): void {
    if (!this.currentPassword.trim()) {
      this.statusType.set('error');
      this.statusMessage.set('Current password is required to update profile settings.');
      return;
    }

    this.isSaving.set(true);
    this.authService
      .updateDetails({
        username: this.username.trim(),
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
        bio: this.bio.trim(),
        password: this.currentPassword,
        newPassword: this.newPassword.trim() ? this.newPassword : undefined
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (message) => {
          this.statusType.set('success');
          this.statusMessage.set(message || 'Profile updated successfully.');
          this.currentPassword = '';
          this.newPassword = '';
          this.loadProfile();
        },
        error: (error: { error?: { error?: string } }) => {
          this.statusType.set('error');
          this.statusMessage.set(error.error?.error ?? 'Failed to update profile settings.');
        }
      });
  }

  protected uploadAvatar(): void {
    if (!this.selectedAvatarFile) {
      return;
    }

    this.isUploading.set(true);
    this.authService
      .uploadAvatar(this.selectedAvatarFile)
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        next: (updatedUser) => {
          this.user.set(updatedUser);
          this.selectedAvatarFile = null;
          this.statusType.set('success');
          this.statusMessage.set('Profile image uploaded successfully.');
        },
        error: (error: { error?: { error?: string } }) => {
          this.statusType.set('error');
          this.statusMessage.set(error.error?.error ?? 'Failed to upload profile image.');
        }
      });
  }

  protected onAvatarImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;

    if (!target) {
      return;
    }

    const fallback = this.buildInitialsAvatar();

    if (target.src !== fallback) {
      target.src = fallback;
    }
  }

  protected avatarUrl(): string {
    const avatar = this.user()?.avatar;

    if (!avatar) {
      return this.buildInitialsAvatar();
    }

    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }

    return `http://localhost:5000${avatar}`;
  }

  private buildInitialsAvatar(): string {
    const current = this.user();
    const firstInitial = current?.firstName?.trim().charAt(0) ?? current?.username?.trim().charAt(0) ?? 'U';
    const lastInitial = current?.lastName?.trim().charAt(0) ?? '';
    const initials = `${firstInitial}${lastInitial}`.toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="38" fill="#1f7a66"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="82" font-weight="700" fill="#ffffff">${initials}</text></svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private setAvatarFile(file: File | null): void {
    if (!file || !file.type.startsWith('image/')) {
      this.selectedAvatarFile = null;
      return;
    }

    this.selectedAvatarFile = file;
  }
}
