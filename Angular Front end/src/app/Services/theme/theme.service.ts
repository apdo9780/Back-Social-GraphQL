import { Injectable, computed, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'social-app-theme';

type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly mode = signal<ThemeMode>('light');

  readonly isDarkMode = computed(() => this.mode() === 'dark');

  initialize(): void {
    const persisted = this.readPersistedMode();
    const systemPreference =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    this.applyMode(persisted ?? systemPreference);
  }

  toggleMode(): void {
    const nextMode: ThemeMode = this.mode() === 'dark' ? 'light' : 'dark';
    this.applyMode(nextMode);
  }

  private applyMode(mode: ThemeMode): void {
    this.mode.set(mode);

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'dark');
      document.documentElement.setAttribute('data-theme', mode);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  }

  private readPersistedMode(): ThemeMode | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  }
}
