import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { canAccessAdminPanel } from './auth.models';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(
    map(() => {
      if (auth.isAuthenticated() && canAccessAdminPanel(auth.user())) {
        return true;
      }
      return router.createUrlTree(['/login']);
    }),
  );
};

/** Super-admin only (legacy). Prefer permissionGuard for new screens. */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(
    map(() => {
      if (auth.isAuthenticated() && auth.user()?.role === 'ADMIN') return true;
      if (auth.isAuthenticated() && canAccessAdminPanel(auth.user())) {
        return router.createUrlTree(['/reports']);
      }
      return router.createUrlTree(['/login']);
    }),
  );
};

/** Allow if the user has any of the listed permissions. */
export function permissionGuard(...keys: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.ensureSession().pipe(
      map(() => {
        if (!auth.isAuthenticated() || !canAccessAdminPanel(auth.user())) {
          return router.createUrlTree(['/login']);
        }
        if (auth.can(...keys)) return true;
        // Prefer first permitted home-ish route instead of a locked reports page.
        const fallback = firstAllowedPath(auth) ?? '/login';
        return router.createUrlTree([fallback]);
      }),
    );
  };
}

function firstAllowedPath(auth: AuthService): string | null {
  const candidates: Array<{ path: string; permissions: string[] }> = [
    { path: '/reports', permissions: ['reports.read'] },
    { path: '/orders', permissions: ['orders.read'] },
    { path: '/shops', permissions: ['shops.read'] },
    { path: '/approvals', permissions: ['shops.approve'] },
    { path: '/invoices', permissions: ['invoices.read'] },
    { path: '/users', permissions: ['users.read'] },
  ];
  for (const c of candidates) {
    if (auth.can(...c.permissions)) return c.path;
  }
  return null;
}
