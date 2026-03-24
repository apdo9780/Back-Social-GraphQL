import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LoadingService } from './Services/api/loading.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly loadingService = inject(LoadingService);

  protected readonly title = signal('angular-front-end');
  protected readonly isLoading = this.loadingService.isLoading;
}
