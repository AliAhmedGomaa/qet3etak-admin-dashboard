import { Injectable, inject, signal } from '@angular/core';
import { BrandingService } from '../branding/branding.service';

export type ColorTheme = 'light' | 'dark';

const STORAGE_KEY = 'qet3etak.admin.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly branding = inject(BrandingService);
  readonly theme = signal<ColorTheme>('light');

  /** Apply saved preference, or system preference if none saved. */
  init(): void {
    this.apply(this.resolveInitial());
  }

  toggle(): void {
    this.apply(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: ColorTheme): void {
    this.apply(theme);
  }

  private resolveInitial(): ColorTheme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      /* private mode / SSR */
    }
    if (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }

  private apply(theme: ColorTheme): void {
    this.theme.set(theme);
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc');
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore quota / private mode */
    }
    this.branding.reapply();
  }
}
