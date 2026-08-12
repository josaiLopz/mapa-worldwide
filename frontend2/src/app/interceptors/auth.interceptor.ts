import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE } from '../api.config';

import { AuthService } from '../../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token || !request.url.startsWith(API_BASE)) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  })).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authService.cerrarSesionExpirada('Tu sesión expiró. Inicia sesión nuevamente.');
      }
      return throwError(() => error);
    })
  );
};
