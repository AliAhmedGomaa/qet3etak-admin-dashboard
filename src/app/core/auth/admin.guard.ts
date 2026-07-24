import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { canAccessAdminPanel } from './auth.models';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && canAccessAdminPanel(auth.user())) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

/** Super-admin only (branches CRUD, users, roles, HQ tools). */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.user()?.role === 'ADMIN') return true;
  if (auth.isAuthenticated() && canAccessAdminPanel(auth.user())) {
    return router.createUrlTree(['/reports']);
  }
  return router.createUrlTree(['/login']);
};
