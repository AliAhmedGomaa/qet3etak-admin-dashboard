import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" dir="rtl">
      <aside class="sidebar">
        <div class="brand">
          <span class="mark">ق</span>
          <div>
            <strong>قطع غيار</strong>
            <small>لوحة الإدارة</small>
          </div>
        </div>
        <nav>
          <a routerLink="/approvals" routerLinkActive="active">اعتماد المتاجر</a>
          <a routerLink="/inventory" routerLinkActive="active">المخزون</a>
          <a routerLink="/credit" routerLinkActive="active">دفتر الائتمان</a>
          <a routerLink="/orders-board" routerLinkActive="active">لوحة الطلبات</a>
          <a routerLink="/special-requests" routerLinkActive="active">الطلبات الخاصة</a>
          <a routerLink="/broadcast" routerLinkActive="active">بث إعلان</a>
        </nav>
        <button type="button" class="logout" (click)="auth.logout()">تسجيل الخروج</button>
      </aside>
      <main class="main">
        <header class="toolbar">
          <span>{{ auth.user()?.fullName }}</span>
        </header>
        <div class="content">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: `
    .shell { display: flex; min-height: 100dvh; background: #f8fafc; }
    .sidebar {
      width: 16rem; background: #0f172a; color: #f8fafc;
      padding: 1.25rem 0.85rem; display: flex; flex-direction: column; gap: 1.25rem;
    }
    .brand { display: flex; gap: 0.75rem; align-items: center; padding: 0 0.4rem; }
    .mark {
      width: 2.25rem; height: 2.25rem; border-radius: 0.65rem; background: #10b880;
      display: grid; place-items: center; font-weight: 800;
    }
    .brand strong { display: block; font-size: 0.95rem; }
    .brand small { color: rgba(248,250,252,0.55); font-size: 0.7rem; }
    nav { display: grid; gap: 0.35rem; flex: 1; }
    nav a {
      color: rgba(248,250,252,0.72); text-decoration: none; min-height: 2.75rem;
      display: flex; align-items: center; padding: 0 0.85rem; border-radius: 0.65rem;
      font-size: 0.9rem; font-weight: 500;
    }
    nav a:hover { background: rgba(255,255,255,0.08); color: #fff; }
    nav a.active {
      background: rgba(16,184,128,0.18); color: #fff;
      box-shadow: inset -3px 0 0 #10b880;
    }
    .logout {
      border: 0; background: rgba(255,255,255,0.08); color: #fff; min-height: 2.75rem;
      border-radius: 0.65rem; font: inherit; cursor: pointer;
    }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .toolbar {
      height: 3.75rem; display: flex; align-items: center; justify-content: flex-start;
      padding: 0 1.5rem; border-bottom: 1px solid #e2e8f0;
      background: rgba(255,255,255,0.75); backdrop-filter: blur(12px);
      color: #64748b; font-size: 0.85rem;
    }
    .content { padding: 1.5rem; flex: 1; overflow: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly auth = inject(AuthService);
}
