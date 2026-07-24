import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule],
  template: `
    <section class="login" dir="rtl">
      <button type="button" class="theme-toggle" (click)="theme.toggle()">
        {{ theme.theme() === 'dark' ? '☀ فاتح' : '☾ داكن' }}
      </button>
      <div class="login__card">
        <h1>قطع غيار · الإدارة</h1>
        <p>سجّل الدخول لمراجعة المتاجر والمخزون والطلبات</p>
        @if (expired()) {
          <p class="notice">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</p>
        }
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span>رقم الجوال</span>
            <input formControlName="phone" type="tel" autocomplete="username" />
          </label>
          <label>
            <span>كلمة المرور</span>
            <input formControlName="password" type="password" autocomplete="current-password" />
          </label>
          @if (error()) {
            <p class="err">{{ error() }}</p>
          }
          <button type="submit" [disabled]="submitting()">
            {{ submitting() ? 'جارٍ الدخول…' : 'تسجيل الدخول' }}
          </button>
        </form>
        <p class="hint">الافتراضي: 0500000000 / Admin123!</p>
      </div>
    </section>
  `,
  styles: `
    .login {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background:
        radial-gradient(ellipse at top, color-mix(in srgb, var(--accent) 18%, transparent), transparent 50%),
        var(--surface-muted);
      color: var(--ink);
      position: relative;
    }
    .theme-toggle {
      position: absolute;
      top: 1rem;
      inset-inline-start: 1rem;
      min-height: 2.4rem;
      padding: 0 0.85rem;
      border: 1.5px solid var(--border);
      border-radius: 0.65rem;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
    }
    .login__card {
      width: min(100%, 24rem);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: var(--shadow);
    }
    h1 { margin: 0; font-size: 1.35rem; color: var(--ink); }
    p { margin: 0.35rem 0 1.1rem; color: var(--ink-muted); font-size: 0.9rem; }
    form { display: grid; gap: 0.85rem; }
    label { display: grid; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: var(--ink); }
    input {
      min-height: 3rem; border: 1.5px solid var(--border); border-radius: 0.75rem;
      padding: 0.6rem 0.85rem; font: inherit; background: var(--input-bg); color: inherit;
    }
    button[type='submit'] {
      min-height: 3rem; border: 0; border-radius: 0.75rem; background: var(--brand);
      color: #fff; font: inherit; font-weight: 700; cursor: pointer;
    }
    html[data-theme='dark'] button[type='submit'] {
      background: var(--accent);
      color: #042f1e;
    }
    .err { margin: 0; padding: 0.65rem 0.8rem; background: var(--danger-bg); color: var(--danger); border-radius: 0.65rem; font-size: 0.85rem; }
    .notice { margin: 0 0 1rem; padding: 0.65rem 0.8rem; background: var(--warning-bg); color: var(--warning-ink); border-radius: 0.65rem; font-size: 0.85rem; }
    .hint { margin: 1rem 0 0; font-size: 0.75rem; color: var(--ink-soft); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLogin {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly theme = inject(ThemeService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expired = signal(
    this.route.snapshot.queryParamMap.get('expired') === '1',
  );

  protected readonly form = this.fb.nonNullable.group({
    phone: ['0500000000', Validators.required],
    password: ['Admin123!', [Validators.required, Validators.minLength(6)]],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    const { phone, password } = this.form.getRawValue();
    this.auth.login(phone, password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/approvals');
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('بيانات الدخول غير صحيحة أو ليست صلاحية مدير');
      },
    });
  }
}
