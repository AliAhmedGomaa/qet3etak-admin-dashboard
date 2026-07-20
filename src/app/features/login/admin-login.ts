import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule],
  template: `
    <section class="login" dir="rtl">
      <div class="login__card">
        <h1>قطع غيار · الإدارة</h1>
        <p>سجّل الدخول لمراجعة المتاجر والمخزون والطلبات</p>
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
        radial-gradient(ellipse at top, rgba(16, 184, 128, 0.12), transparent 50%),
        #f8fafc;
    }
    .login__card {
      width: min(100%, 24rem);
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }
    h1 { margin: 0; font-size: 1.35rem; color: #0f172a; }
    p { margin: 0.35rem 0 1.1rem; color: #64748b; font-size: 0.9rem; }
    form { display: grid; gap: 0.85rem; }
    label { display: grid; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: #334155; }
    input {
      min-height: 3rem; border: 1.5px solid #e2e8f0; border-radius: 0.75rem;
      padding: 0.6rem 0.85rem; font: inherit; background: #f8fafc;
    }
    button {
      min-height: 3rem; border: 0; border-radius: 0.75rem; background: #0f172a;
      color: #fff; font: inherit; font-weight: 700; cursor: pointer;
    }
    .err { margin: 0; padding: 0.65rem 0.8rem; background: #fef2f2; color: #991b1b; border-radius: 0.65rem; font-size: 0.85rem; }
    .hint { margin: 1rem 0 0; font-size: 0.75rem; color: #94a3b8; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLogin {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

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
