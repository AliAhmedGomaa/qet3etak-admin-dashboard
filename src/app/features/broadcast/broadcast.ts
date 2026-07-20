import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminSpecialRequestsApi } from '../../core/special-requests/admin-special-requests.api';

@Component({
  selector: 'app-broadcast',
  imports: [FormsModule],
  template: `
    <section class="broadcast" dir="rtl">
      <header>
        <h1>أداة البث الجماعي</h1>
        <p>
          أرسل إشعارات ويب دفعة واحدة لجميع أصحاب المتاجر المسجّلين — مثال: وصول شحنة شاشات أصلية.
        </p>
      </header>

      <div class="layout">
        <form class="card" (ngSubmit)="send()">
          <label>
            العنوان
            <input
              [ngModel]="title()"
              (ngModelChange)="title.set($event)"
              name="title"
              required
              minlength="3"
              maxlength="80"
              placeholder="وصلت شحنة شاشات أصلية للآيفون!"
            />
          </label>

          <label>
            نص الإعلان
            <textarea
              class="rich"
              [ngModel]="body()"
              (ngModelChange)="body.set($event)"
              name="body"
              rows="8"
              required
              minlength="3"
              maxlength="500"
              placeholder="المخزون الجديد متاح في الكتالوج — راجع الشاشات ← آبل."
            ></textarea>
            <span class="hint">{{ body().length }} / 500</span>
          </label>

          <div class="toolbar" role="group" aria-label="تنسيق سريع">
            <button type="button" class="chip" (click)="appendSnippet('📦 شحنة جديدة وصلت')">شحنة</button>
            <button type="button" class="chip" (click)="appendSnippet('🔥 عرض محدود اليوم')">عرض</button>
            <button type="button" class="chip" (click)="appendSnippet('راجع الكتالوج الآن')">كتالوج</button>
          </div>

          <label>
            رابط عميق (اختياري)
            <input
              [ngModel]="url()"
              (ngModelChange)="url.set($event)"
              name="url"
              placeholder="/catalog"
            />
          </label>

          @if (result() !== null) {
            <p class="ok">أُرسل بنجاح إلى {{ result() }} اشتراك/اشتراكات.</p>
          }
          @if (error()) {
            <p class="err">{{ error() }}</p>
          }

          <button
            type="submit"
            [disabled]="busy() || title().trim().length < 3 || body().trim().length < 3"
          >
            {{ busy() ? 'جارٍ الإرسال…' : 'إرسال البث لجميع المتاجر' }}
          </button>
        </form>

        <aside class="preview" aria-live="polite">
          <h2>معاينة الإشعار</h2>
          <div class="toast">
            <img src="/favicon.ico" width="36" height="36" alt="" />
            <div>
              <strong>{{ title().trim() || 'عنوان الإعلان…' }}</strong>
              <p>{{ body().trim() || 'نص الرسالة يظهر هنا أثناء الكتابة.' }}</p>
              <small>قطع الغيار · الآن</small>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .broadcast { display: grid; gap: 1.1rem; }
    header h1 { margin: 0; font-size: 1.45rem; }
    header p { margin: 0.35rem 0 0; color: #64748b; max-width: 42rem; line-height: 1.5; }
    .layout {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 0.8fr);
      align-items: start;
    }
    .card, .preview {
      background: rgba(255,255,255,0.92);
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 1.25rem;
      box-shadow: 0 10px 28px rgba(15,23,42,0.06);
    }
    .card { display: grid; gap: 0.85rem; }
    label { display: grid; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: #334155; }
    input, textarea {
      border: 1.5px solid #e2e8f0; border-radius: 0.65rem;
      padding: 0.7rem 0.85rem; font: inherit; font-weight: 500;
    }
    textarea.rich {
      min-height: 10rem;
      line-height: 1.55;
      resize: vertical;
    }
    .hint { font-size: 0.72rem; color: #94a3b8; font-weight: 500; justify-self: end; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 999px;
      padding: 0.35rem 0.75rem; font: inherit; font-size: 0.78rem; font-weight: 600;
      cursor: pointer; color: #334155;
    }
    .chip:hover { border-color: #10b880; color: #0d9a6a; }
    button[type='submit'] {
      min-height: 3rem; border: 0; border-radius: 0.75rem;
      background: #10b880; color: #fff; font: inherit; font-weight: 800; cursor: pointer;
    }
    button[type='submit']:disabled { opacity: 0.6; cursor: wait; }
    .ok { margin: 0; color: #0d9a6a; background: #ecfdf6; padding: 0.7rem 0.85rem; border-radius: 0.65rem; }
    .err { margin: 0; color: #991b1b; background: #fef2f2; padding: 0.7rem 0.85rem; border-radius: 0.65rem; }
    .preview h2 { margin: 0 0 0.85rem; font-size: 0.95rem; }
    .toast {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.75rem;
      padding: 0.85rem;
      border-radius: 0.9rem;
      background: #0f172a;
      color: #f8fafc;
      box-shadow: 0 12px 30px rgba(15,23,42,0.25);
    }
    .toast img { border-radius: 0.5rem; }
    .toast strong { display: block; font-size: 0.9rem; }
    .toast p {
      margin: 0.25rem 0 0; font-size: 0.8rem; color: rgba(248,250,252,0.78);
      line-height: 1.45; white-space: pre-wrap;
    }
    .toast small {
      display: block; margin-top: 0.4rem; color: rgba(248,250,252,0.45); font-size: 0.7rem;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BroadcastPage {
  private readonly api = inject(AdminSpecialRequestsApi);

  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly url = signal('/catalog');
  protected readonly busy = signal(false);
  protected readonly result = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected appendSnippet(text: string): void {
    const current = this.body().trim();
    this.body.set(current ? `${current}\n${text}` : text);
  }

  protected send(): void {
    this.busy.set(true);
    this.result.set(null);
    this.error.set(null);
    this.api
      .broadcast({
        title: this.title().trim(),
        body: this.body().trim(),
        url: this.url().trim() || '/home',
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.result.set(res.sent);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('فشل البث — تأكد من إعداد مفاتيح VAPID');
        },
      });
  }
}
