import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { inject } from '@angular/core';

import { LoadingService } from '../Services/api/loading.service';

export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  if (req.context.get(SKIP_GLOBAL_LOADING)) {
    return next(req);
  }

  loadingService.requestStarted();

  return next(req).pipe(finalize(() => loadingService.requestEnded()));
};