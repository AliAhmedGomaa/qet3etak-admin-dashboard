import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ChatService } from '../core/chat/chat.service';
import { ReturnsAdminService } from '../core/returns/returns-admin.service';
import { HrAdminService } from '../core/hr/hr-admin.service';
import { PushNotificationService } from '../core/push/push-notification.service';
import { PwaInstallService } from '../core/pwa/pwa-install.service';
import { ThemeService } from '../core/theme/theme.service';
import { BrandingService } from '../core/branding/branding.service';

type NavItem = {
  path: string;
  label: string;
  icon: string;
  /** If set, user needs any of these permissions (ADMIN always sees all). */
  permissions?: string[];
};

/** Paths branch managers may use (API still enforces scope). */
const BRANCH_MANAGER_PATHS = new Set([
  '/shops',
  '/credit',
  '/financials',
  '/reports',
  '/orders-board',
  '/invoices',
  '/returns',
]);

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" dir="rtl" [class.shell--nav-open]="navOpen()">
      @if (navOpen()) {
        <button type="button" class="scrim" aria-label="إغلاق القائمة" (click)="navOpen.set(false)"></button>
      }

      <aside class="sidebar">
        <div class="brand">
          @if (branding.branding().logoUrl; as logo) {
            <img class="mark mark--img" [src]="logo" alt="" />
          } @else {
            <span class="mark">{{ branding.branding().appName.slice(0, 1) }}</span>
          }
          <div class="brand__text">
            <strong>{{ branding.branding().appName }}</strong>
            <small>لوحة الإدارة</small>
          </div>
          <button type="button" class="sidebar__close" (click)="navOpen.set(false)" aria-label="إغلاق">
            ✕
          </button>
        </div>

        <nav class="nav">
          <span class="nav__label">القائمة</span>
          @for (item of visibleNavItems(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" (click)="navOpen.set(false)">
              <svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <path [attr.d]="item.icon" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ item.label }}</span>
              @if (item.path === '/chat' && chat.totalUnread() > 0) {
                <em class="nav__badge">{{ chat.totalUnread() }}</em>
              }
              @if (item.path === '/returns' && returns.pendingCount() > 0) {
                <em class="nav__badge">{{ returns.pendingCount() }}</em>
              }
              @if (item.path === '/employees/vacations' && hr.pendingVacationCount() > 0) {
                <em class="nav__badge">{{ hr.pendingVacationCount() }}</em>
              }
            </a>
          }
        </nav>

        <div class="sidebar__footer">
          <button type="button" class="logout" (click)="auth.logout()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <main class="main">
        <header class="toolbar">
          <div class="toolbar__start">
            <button type="button" class="menu-btn" (click)="navOpen.set(true)" aria-label="القائمة">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <span class="toolbar__name">{{ auth.user()?.fullName }}</span>
          </div>
          <div class="toolbar__actions">
            <button
              type="button"
              class="theme-toggle"
              (click)="theme.toggle()"
              [attr.aria-label]="theme.theme() === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'"
              [title]="theme.theme() === 'dark' ? 'فاتح' : 'داكن'"
            >
              @if (theme.theme() === 'dark') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                <span class="theme-toggle__label">فاتح</span>
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
                <span class="theme-toggle__label">داكن</span>
              }
            </button>
            @if (pwa.canNativeInstall()) {
              <button type="button" class="bell install" (click)="installApp()">تثبيت التطبيق</button>
            }
            @if (push.supported()) {
              <button
                type="button"
                class="bell"
                [class.on]="push.enabled()"
                [disabled]="push.busy()"
                (click)="push.toggle()"
                [title]="push.enabled() ? 'إيقاف إشعارات المحادثات' : 'تفعيل إشعارات المحادثات'"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="bell__label">{{ push.enabled() ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات' }}</span>
              </button>
            }
            @if (push.lastError(); as pushErr) {
              <span class="push-err" [title]="pushErr">{{ pushErr }}</span>
            }
          </div>
        </header>
        <div class="content app-shell-content">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: `
    .shell {
      display: flex;
      height: 100dvh;
      min-height: 100dvh;
      overflow: hidden;
      background: var(--surface-muted);
      color: var(--ink);
    }

    .sidebar {
      width: 15.5rem;
      background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
      color: #f8fafc;
      /* Safe-area: notch / home indicator / landscape edges (RTL drawer OK). */
      padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
      padding-left: calc(0.75rem + env(safe-area-inset-left, 0px));
      padding-right: calc(0.75rem + env(safe-area-inset-right, 0px));
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      overflow: hidden;
      border-inline-start: 1px solid rgba(255, 255, 255, 0.06);
      box-sizing: border-box;
    }

    .brand {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      padding: 0.25rem 0.5rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 1rem;
      flex-shrink: 0;
    }

    .mark {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 1.1rem;
      flex-shrink: 0;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent);
      object-fit: cover;
    }

    .mark--img {
      background: #fff;
      padding: 0.2rem;
      box-sizing: border-box;
    }

    .brand__text strong {
      display: block;
      font-size: 0.95rem;
      font-weight: 700;
      line-height: 1.3;
    }

    .brand__text small {
      color: rgba(248, 250, 252, 0.5);
      font-size: 0.7rem;
    }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      align-content: start;
      padding: 0 0.15rem;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: rgba(248, 250, 252, 0.28) transparent;
    }

    .nav::-webkit-scrollbar {
      width: 0.35rem;
    }

    .nav::-webkit-scrollbar-thumb {
      background: rgba(248, 250, 252, 0.28);
      border-radius: 999px;
    }

    .nav__label {
      padding: 0 0.65rem 0.5rem;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgba(248, 250, 252, 0.35);
      flex-shrink: 0;
    }

    .nav a {
      color: rgba(248, 250, 252, 0.68);
      text-decoration: none;
      height: 2.85rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0 0.75rem;
      border-radius: 0.6rem;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }

    .nav__icon {
      width: 1.15rem;
      height: 1.15rem;
      flex-shrink: 0;
      opacity: 0.75;
    }

    .nav a:hover {
      background: rgba(255, 255, 255, 0.07);
      color: #fff;
    }

    .nav a:hover .nav__icon {
      opacity: 1;
    }

    .nav a.active {
      background: rgba(16, 184, 128, 0.15);
      color: #fff;
      font-weight: 600;
      box-shadow: inset -3px 0 0 #10b880;
    }

    .nav a.active .nav__icon {
      opacity: 1;
      color: #34d399;
    }

    .nav__badge {
      margin-inline-start: auto;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 0.35rem;
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: 0.68rem;
      font-style: normal;
      font-weight: 800;
      display: grid;
      place-items: center;
    }

    .sidebar__footer {
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }

    .logout {
      width: 100%;
      border: 0;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(248, 250, 252, 0.8);
      height: 2.85rem;
      border-radius: 0.6rem;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.65rem;
      padding: 0 0.75rem;
      transition: background 0.15s, color 0.15s;
    }

    .logout svg {
      width: 1.1rem;
      height: 1.1rem;
    }

    .logout:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
    }

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }

    .toolbar {
      height: 3.75rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0 calc(1rem + env(safe-area-inset-right, 0px)) 0
        calc(1rem + env(safe-area-inset-left, 0px));
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--surface) 88%, transparent);
      backdrop-filter: blur(12px);
      color: var(--ink-muted);
      font-size: 0.85rem;
      box-sizing: border-box;
    }

    .toolbar__start,
    .toolbar__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .toolbar__name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .menu-btn,
    .sidebar__close {
      display: none;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: 0.6rem;
      background: var(--row-hover);
      color: var(--ink);
      cursor: pointer;
    }

    .theme-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      height: 2.25rem;
      padding: 0 0.75rem;
      border: 1.5px solid var(--border);
      border-radius: 0.6rem;
      background: var(--surface);
      color: var(--ink-muted);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .theme-toggle svg {
      width: 1.05rem;
      height: 1.05rem;
    }

    .theme-toggle:hover {
      background: var(--row-hover);
      color: var(--ink);
    }

    .menu-btn svg {
      width: 1.25rem;
      height: 1.25rem;
    }

    .scrim {
      display: none;
    }

    .bell {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      height: 2.25rem;
      padding: 0 0.85rem;
      border: 1.5px solid var(--border);
      border-radius: 0.6rem;
      background: var(--surface);
      color: var(--ink-muted);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .bell.install {
      background: var(--accent-soft);
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      color: var(--accent-strong);
    }

    .push-err {
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--danger, #b91c1c);
    }

    .bell svg {
      width: 1.05rem;
      height: 1.05rem;
    }

    .bell:hover:not(:disabled) {
      background: var(--row-hover);
      color: var(--ink);
    }

    .bell.on {
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      background: var(--accent-soft);
      color: var(--accent-strong);
    }

    .bell:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .content {
      padding: 1rem 1.15rem 0;
      padding-left: calc(1.15rem + env(safe-area-inset-left, 0px));
      padding-right: calc(1.15rem + env(safe-area-inset-right, 0px));
      padding-bottom: max(0px, env(safe-area-inset-bottom, 0px));
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      position: relative;
    }

    @media (max-width: 900px) {
      /* Keep flex so .main/.content retain height — display:block collapses
         flex:1 children (routed pages) to 0 and only the drawer appears. */
      .shell {
        display: flex;
      }

      .scrim {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 40;
        border: 0;
        background: rgba(15, 23, 42, 0.45);
      }

      .sidebar {
        position: fixed;
        inset-block: 0;
        inset-inline-start: 0;
        z-index: 50;
        width: min(18rem, 86vw);
        /* Off-canvas toward the inline-start edge (right in RTL). */
        transform: translateX(110%);
        transition: transform 0.22s ease;
        box-shadow: -8px 0 32px rgba(15, 23, 42, 0.25);
        pointer-events: none;
        visibility: hidden;
      }

      .shell--nav-open .sidebar {
        transform: translateX(0);
        pointer-events: auto;
        visibility: visible;
      }

      .main {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 100dvh;
        height: 100dvh;
      }

      .menu-btn {
        display: inline-flex;
      }

      .sidebar__close {
        display: inline-flex;
        margin-inline-start: auto;
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }

      .brand {
        padding-inline-end: 0.25rem;
      }

      .toolbar {
        padding-top: env(safe-area-inset-top, 0px);
        padding-left: calc(1rem + env(safe-area-inset-left, 0px));
        padding-right: calc(1rem + env(safe-area-inset-right, 0px));
        height: calc(3.75rem + env(safe-area-inset-top, 0px));
      }

      .bell__label,
      .theme-toggle__label {
        display: none;
      }

      .content {
        padding: 1rem 1rem 0;
        padding-left: calc(1rem + env(safe-area-inset-left, 0px));
        padding-right: calc(1rem + env(safe-area-inset-right, 0px));
        padding-bottom: max(0px, env(safe-area-inset-bottom, 0px));
        flex: 1 1 auto;
        min-height: 0;
      }
    }

    @media (min-width: 901px) {
      .toolbar {
        padding: 0 calc(1.15rem + env(safe-area-inset-right, 0px)) 0
          calc(1.15rem + env(safe-area-inset-left, 0px));
      }

      .content {
        padding-left: calc(1.15rem + env(safe-area-inset-left, 0px));
        padding-right: calc(1.15rem + env(safe-area-inset-right, 0px));
        padding-bottom: max(0px, env(safe-area-inset-bottom, 0px));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell implements OnInit {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly chat = inject(ChatService);
  protected readonly returns = inject(ReturnsAdminService);
  protected readonly hr = inject(HrAdminService);
  protected readonly push = inject(PushNotificationService);
  protected readonly pwa = inject(PwaInstallService);
  protected readonly theme = inject(ThemeService);
  protected readonly branding = inject(BrandingService);

  protected readonly navOpen = signal(false);

  ngOnInit(): void {
    this.auth.ensureSession().subscribe();
    this.pwa.init();
    this.chat.connect();
    this.chat.loadConversations().subscribe();
    this.returns.startWatching();
    this.hr.startWatchingVacations();
    this.push.listenForPush();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.navOpen.set(false));
  }

  protected async installApp(): Promise<void> {
    await this.pwa.promptInstall();
  }

  protected readonly allNavItems: NavItem[] = [
    {
      path: '/approvals',
      permissions: ['shops.approve'],
      label: 'اعتماد المتاجر',
      icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      path: '/shops',
      permissions: ['shops.read'],
      label: 'المتاجر',
      icon: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .414.336.75.75.75z',
    },
    {
      path: '/users',
      permissions: ['users.read'],
      label: 'المستخدمون',
      icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.108-2.008-.26-2.642m0 2.645a14.814 14.814 0 01-.26 2.642m0-2.645a14.927 14.927 0 00-4.487-2.97m4.487 2.97c-.318.052-.642.09-.972.115a14.83 14.83 0 01-4.487-2.97M3.375 19.5h.008v.008H3.375V19.5zM3.75 12a8.25 8.25 0 1116.5 0 8.25 8.25 0 01-16.5 0z',
    },
    {
      path: '/roles',
      permissions: ['roles.read', 'roles.manage'],
      label: 'الأدوار',
      icon: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
    },
    {
      path: '/branches',
      permissions: ['branches.read', 'branches.manage'],
      label: 'الفروع',
      icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
    },
    {
      path: '/inventory',
      permissions: ['products.read', 'products.manage', 'inventory.manage'],
      label: 'المخزون',
      icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
    },
    {
      path: '/brands',
      permissions: ['brands.manage'],
      label: 'الماركات',
      icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
    },
    {
      path: '/categories',
      permissions: ['categories.manage'],
      label: 'الفئات',
      icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
    },
    {
      path: '/qualities',
      permissions: ['qualities.manage'],
      label: 'درجات الجودة',
      icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
    },
    {
      path: '/credit',
      permissions: ['credit.read'],
      label: 'دفتر الائتمان',
      icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
    },
    {
      path: '/financials',
      permissions: ['financials.read'],
      label: 'التحليلات المالية',
      icon: 'M3 3v18h18M18.75 8.25l-5.25 5.25-3-3L6.75 14.25',
    },
    {
      path: '/reports',
      permissions: ['reports.read'],
      label: 'التقارير',
      icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    },
    {
      path: '/orders-board',
      permissions: ['orders.read'],
      label: 'لوحة الطلبات',
      icon: 'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z',
    },
    {
      path: '/invoices',
      permissions: ['invoices.read'],
      label: 'الفواتير',
      icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    },
    {
      path: '/delivery-guys',
      permissions: ['delivery.read', 'delivery.manage'],
      label: 'مندوبو التوصيل',
      icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h12.75c.621 0 1.125-.504 1.125-1.125V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v6.75c0 .621.504 1.125 1.125 1.125z',
    },
    {
      path: '/employees',
      permissions: ['hr.read', 'hr.manage'],
      label: 'الموظفون',
      icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
    },
    {
      path: '/employees/vacations',
      permissions: ['hr.vacations', 'hr.manage'],
      label: 'طلبات الإجازات',
      icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
    },
    {
      path: '/special-requests',
      permissions: ['special_requests.read', 'special_requests.manage'],
      label: 'الطلبات الخاصة',
      icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456z',
    },
    {
      path: '/returns',
      permissions: ['returns.read'],
      label: 'المرتجعات',
      icon: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
    },
    {
      path: '/broadcast',
      permissions: ['broadcast.manage'],
      label: 'بث إعلان',
      icon: 'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z',
    },
    {
      path: '/chat',
      permissions: ['chat.manage'],
      label: 'المحادثات',
      icon: 'M8.25 8.25h7.5M8.25 12h4.5m6.75-1.5a8.25 8.25 0 01-11.4 7.62L3 19.5l1.38-4.1A8.25 8.25 0 1119.5 10.5z',
    },
    {
      path: '/branding',
      permissions: ['branding.manage'],
      label: 'هوية المنصة',
      icon: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42',
    },
  ];

  protected readonly visibleNavItems = computed(() => {
    const user = this.auth.user();
    if (!user) return [];
    const items = this.allNavItems.filter((item) => {
      if (!item.permissions?.length) return true;
      return this.auth.can(...item.permissions);
    });
    if (user.role === 'BRANCH_MANAGER' || this.auth.can('admin.branch_scoped')) {
      // Keep branch managers on the scoped subset unless they have broader grants.
      if (user.role === 'BRANCH_MANAGER') {
        return items.filter((item) => BRANCH_MANAGER_PATHS.has(item.path));
      }
    }
    return items;
  });
}
