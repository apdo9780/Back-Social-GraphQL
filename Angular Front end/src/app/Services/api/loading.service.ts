import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private readonly activeRequestsSignal = signal(0);

  readonly activeRequests = this.activeRequestsSignal.asReadonly();
  readonly isLoading = computed(() => this.activeRequestsSignal() > 0);

  requestStarted(): void {
    this.activeRequestsSignal.update((count) => count + 1);
  }

  requestEnded(): void {
    this.activeRequestsSignal.update((count) => Math.max(0, count - 1));
  }
}