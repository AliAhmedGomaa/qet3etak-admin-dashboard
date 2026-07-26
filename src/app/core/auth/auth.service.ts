import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, ShopUser, canAccessAdminPanel } from './auth.models';

const TOKEN_KEY = 'qet3etak.admin.token';
const USER_KEY = 'qet3etak.admin.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenSignal = signal<string | null>(this.read(TOKEN_KEY));
  private readonly userSignal = signal<ShopUser | null>(this.readUser());

  readonly user = this.userSignal.asReadonly();
  readonly token = this.tokenSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly isSuperAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly isBranchManager = computed(
    () => this.user()?.role === 'BRANCH_MANAGER',
  );
  readonly branchId = computed(() => this.user()?.branchId ?? null);
  readonly permissions = computed(() => this.user()?.permissions ?? []);

  login(phone: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { phone, password })
      .pipe(
        map((res) => {
          if (!canAccessAdminPanel(res.user)) {
            throw { error: { message: 'Admin access only' } };
          }
          return res;
        }),
        tap((res) => this.persist(res)),
      );
  }

  /** Refresh profile + permissions from /auth/me (keeps local session in sync). */
  refreshMe(): Observable<ShopUser | null> {
    if (!this.tokenSignal()) return of(null);
    return this.http.get<ShopUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => {
        this.userSignal.set(user);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        } catch {
          /* ignore */
        }
      }),
      catchError(() => of(null)),
    );
  }

  /** True if the current user has any of the given permission keys. ADMIN always true. */
  can(...keys: string[]): boolean {
    if (!keys.length) return true;
    const user = this.user();
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    const held = new Set(user.permissions ?? []);
    if (held.has('*')) return true;
    return keys.some((k) => held.has(k) || held.has(this.manageKey(k)));
  }

  canAll(...keys: string[]): boolean {
    if (!keys.length) return true;
    const user = this.user();
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    const held = new Set(user.permissions ?? []);
    if (held.has('*')) return true;
    return keys.every((k) => held.has(k) || held.has(this.manageKey(k)));
  }

  logout(): void {
    this.clearSession();
    void this.router.navigateByUrl('/login');
  }

  /** Triggered when the server rejects the stored token (expired / removed). */
  sessionExpired(): void {
    if (!this.tokenSignal()) return;
    this.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: { expired: '1' },
    });
  }

  private manageKey(key: string): string {
    const i = key.lastIndexOf('.');
    if (i < 0) return key;
    return `${key.slice(0, i)}.manage`;
  }

  private clearSession(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  authHeader(): string | null {
    const t = this.tokenSignal();
    return t ? `Bearer ${t}` : null;
  }

  private persist(res: AuthResponse): void {
    this.tokenSignal.set(res.accessToken);
    this.userSignal.set(res.user);
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private readUser(): ShopUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as ShopUser) : null;
    } catch {
      return null;
    }
  }
}
