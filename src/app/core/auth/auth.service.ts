import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
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
