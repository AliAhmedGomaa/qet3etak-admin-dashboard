import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Clears the session and redirects to login when the server rejects the
 * stored token (expired / user no longer exists). Skips the login request
 * itself so wrong-credentials errors surface normally.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err) => {
      const isLogin = req.url.includes('/auth/login');
      if (err?.status === 401 && !isLogin && auth.isAuthenticated()) {
        auth.sessionExpired();
      }
      return throwError(() => err);
    }),
  );
};
