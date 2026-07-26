import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DEFAULT_BRANDING,
  PlatformBranding,
} from './branding.models';

const CACHE_KEY = 'qet3etak.branding';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly http = inject(HttpClient);

  readonly branding = signal<PlatformBranding>(this.readCache() ?? DEFAULT_BRANDING);

  /** Load public branding and apply to the document. */
  init(): void {
    this.apply(this.branding());
    this.http
      .get<PlatformBranding>(`${environment.apiUrl}/branding`)
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        if (!data) return;
        this.branding.set(data);
        this.writeCache(data);
        this.apply(data);
      });
  }

  getAdmin(): Observable<PlatformBranding> {
    return this.http.get<PlatformBranding>(
      `${environment.apiUrl}/admin/branding`,
    );
  }

  update(
    patch: Partial<PlatformBranding>,
  ): Observable<PlatformBranding> {
    return this.http
      .patch<PlatformBranding>(`${environment.apiUrl}/admin/branding`, patch)
      .pipe(
        tap((data) => {
          this.branding.set(data);
          this.writeCache(data);
          this.apply(data);
        }),
      );
  }

  uploadLogo(file: File): Observable<PlatformBranding> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http
      .post<PlatformBranding>(
        `${environment.apiUrl}/admin/branding/logo`,
        fd,
      )
      .pipe(
        tap((data) => {
          this.branding.set(data);
          this.writeCache(data);
          this.apply(data);
        }),
      );
  }

  /** Re-apply after light/dark toggle (keeps accents, adjusts --brand). */
  reapply(): void {
    this.apply(this.branding());
  }

  apply(data: PlatformBranding): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const dark = root.getAttribute('data-theme') === 'dark';
    root.style.setProperty('--accent', data.accentColor);
    root.style.setProperty('--accent-strong', data.accentStrongColor);
    root.style.setProperty(
      '--accent-soft',
      this.hexToRgba(data.accentColor, dark ? 0.16 : 0.14),
    );
    root.style.setProperty(
      '--brand',
      dark ? '#e2e8f0' : data.brandColor,
    );

    const titleBase = data.appName?.trim() || DEFAULT_BRANDING.appName;
    document.title = `${titleBase} · لوحة الإدارة`;

    const icon = data.faviconUrl || data.logoUrl;
    if (icon) this.setFavicon(icon);
  }

  private setFavicon(url: string): void {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return `rgba(16, 184, 128, ${alpha})`;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private readCache(): PlatformBranding | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PlatformBranding;
    } catch {
      return null;
    }
  }

  private writeCache(data: PlatformBranding): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
  }
}
