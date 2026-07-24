import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { isAdminPanelRole } from './auth.models';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && isAdminPanelRole(auth.user()?.role)) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

/** Super-admin only (branches CRUD, users, HQ tools). */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.user()?.role === 'ADMIN') return true;
  if (auth.isAuthenticated() && isAdminPanelRole(auth.user()?.role)) {
    return router.createUrlTree(['/reports']);
  }
  return router.createUrlTree(['/login']);
};
