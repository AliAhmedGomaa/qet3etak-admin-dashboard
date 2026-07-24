import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShopUser } from '../../core/auth/auth.models';
import { ShopsAdminService } from '../../core/shops/shops-admin.service';
import { AdminSpecialRequestsApi } from '../../core/special-requests/admin-special-requests.api';

type BroadcastResult = {
  targeted: number;
  sent: number;
  failed: number;
  enabled: boolean;
};

@Component({
  selector: 'app-broadcast',
  imports: [FormsModule],
  template: `
    <section class="broadcast" dir="rtl">
      <header>
        <h1>أداة البث الجماعي</h1>
        <p>
          أرسل إشعارات ويب لأصحاب المتاجر — اختر متاجر محددة، أو اترك التحديد فارغًا
          للإرسال للجميع.
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

          <fieldset class="recipients">
            <legend>المستلمون</legend>
            <p class="scope" [class.scope--all]="selectedCount() === 0">
              @if (selectedCount() === 0) {
                إرسال للجميع — لم يُحدد أي متجر
              } @else {
                سيتم الإرسال إلى {{ selectedCount() }} متجر محدد
              }
            </p>

            <div class="recipients__bar">
              <input
                class="search"
                type="search"
                [ngModel]="shopQuery()"
                (ngModelChange)="onShopQuery($event)"
                name="shopQuery"
                placeholder="ابحث بالاسم أو الهاتف…"
                autocomplete="off"
              />
              @if (selectedCount() > 0) {
                <button type="button" class="linkish" (click)="clearSelection()">
                  مسح التحديد
                </button>
              }
            </div>

            @if (shopsLoading()) {
              <p class="muted">جارٍ تحميل المتاجر…</p>
            } @else if (shopsError()) {
              <p class="err">{{ shopsError() }}</p>
            } @else if (filteredShops().length === 0) {
              <p class="muted">لا توجد متاجر مطابقة.</p>
            } @else {
              <ul class="shop-list" role="listbox" aria-multiselectable="true">
                @for (shop of filteredShops(); track shop.id) {
                  <li>
                    <label class="shop-row">
                      <input
                        type="checkbox"
                        [checked]="isSelected(shop.id)"
                        (change)="toggleShop(shop.id)"
                      />
                      <span class="shop-row__text">
                        <strong>{{ shop.shopName || shop.fullName || 'متجر' }}</strong>
                        <small>{{ shop.phone }}</small>
                      </span>
                    </label>
                  </li>
                }
              </ul>
            }
          </fieldset>

          @if (result(); as res) {
            <p class="ok">
              أُرسل إلى {{ res.sent }} اشتراك (مستهدفون: {{ res.targeted }} متجر
              @if (res.failed > 0) {
                ، فشل: {{ res.failed }}
              }
              ).
            </p>
          }
          @if (error()) {
            <p class="err">{{ error() }}</p>
          }

          <button
            type="submit"
            [disabled]="busy() || title().trim().length < 3 || body().trim().length < 3"
          >
            @if (busy()) {
              جارٍ الإرسال…
            } @else if (selectedCount() === 0) {
              إرسال البث للجميع
            } @else {
              إرسال البث للمتاجر المحددة ({{ selectedCount() }})
            }
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
    .recipients {
      margin: 0;
      padding: 0.85rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.85rem;
      display: grid;
      gap: 0.65rem;
    }
    .recipients legend {
      padding: 0 0.35rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: #334155;
    }
    .scope {
      margin: 0;
      font-size: 0.82rem;
      font-weight: 600;
      color: #0d9a6a;
      background: #ecfdf6;
      padding: 0.55rem 0.7rem;
      border-radius: 0.55rem;
    }
    .scope--all {
      color: #1d4ed8;
      background: #eff6ff;
    }
    .recipients__bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    .search { flex: 1 1 12rem; min-width: 0; }
    .linkish {
      border: 0;
      background: transparent;
      color: #0d9a6a;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0.25rem 0.35rem;
    }
    .shop-list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 14rem;
      overflow: auto;
      border: 1px solid #e2e8f0;
      border-radius: 0.65rem;
    }
    .shop-list li + li { border-top: 1px solid #f1f5f9; }
    .shop-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.65rem;
      align-items: start;
      padding: 0.55rem 0.7rem;
      cursor: pointer;
      font-weight: 500;
    }
    .shop-row:hover { background: #f8fafc; }
    .shop-row input { margin-top: 0.2rem; accent-color: #10b880; }
    .shop-row__text { display: grid; gap: 0.1rem; min-width: 0; }
    .shop-row__text strong {
      font-size: 0.84rem;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .shop-row__text small { color: #64748b; font-size: 0.75rem; }
    .muted { margin: 0; color: #94a3b8; font-size: 0.8rem; }
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
export class BroadcastPage implements OnInit {
  private readonly api = inject(AdminSpecialRequestsApi);
  private readonly shopsApi = inject(ShopsAdminService);

  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly url = signal('/catalog');
  protected readonly busy = signal(false);
  protected readonly result = signal<BroadcastResult | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly shops = signal<ShopUser[]>([]);
  protected readonly shopsLoading = signal(false);
  protected readonly shopsError = signal<string | null>(null);
  protected readonly shopQuery = signal('');
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  protected readonly filteredShops = computed(() => {
    const q = this.shopQuery().trim().toLowerCase();
    const items = this.shops();
    if (!q) return items;
    return items.filter((s) => {
      const name = (s.shopName || s.fullName || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  });

  ngOnInit(): void {
    this.loadShops();
  }

  protected onShopQuery(value: string): void {
    this.shopQuery.set(value);
  }

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected toggleShop(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected appendSnippet(text: string): void {
    const current = this.body().trim();
    this.body.set(current ? `${current}\n${text}` : text);
  }

  protected send(): void {
    this.busy.set(true);
    this.result.set(null);
    this.error.set(null);
    const shopIds = [...this.selectedIds()];
    this.api
      .broadcast({
        title: this.title().trim(),
        body: this.body().trim(),
        url: this.url().trim() || '/home',
        ...(shopIds.length ? { shopIds } : {}),
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.result.set(res);
        },
        error: (err) => {
          this.busy.set(false);
          const invalid = err?.error?.invalidShopIds as string[] | undefined;
          if (invalid?.length) {
            this.error.set(
              'بعض المتاجر المحددة غير صالحة أو غير معتمدة — راجع التحديد وأعد المحاولة.',
            );
            return;
          }
          this.error.set('فشل البث — تأكد من إعداد مفاتيح VAPID');
        },
      });
  }

  private loadShops(): void {
    this.shopsLoading.set(true);
    this.shopsError.set(null);
    this.loadShopsPage(1, []);
  }

  private loadShopsPage(page: number, acc: ShopUser[]): void {
    this.shopsApi.list({ status: 'APPROVED', page, limit: 100 }).subscribe({
      next: (res) => {
        const merged = acc.concat(res.items);
        if (res.page < res.totalPages) {
          this.loadShopsPage(res.page + 1, merged);
          return;
        }
        this.shops.set(merged);
        this.shopsLoading.set(false);
      },
      error: () => {
        this.shopsLoading.set(false);
        this.shopsError.set('تعذر تحميل قائمة المتاجر المعتمدة');
      },
    });
  }
}
