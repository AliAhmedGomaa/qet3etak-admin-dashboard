import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminCommerceService,
  AdminWallet,
} from '../../core/commerce/admin-commerce.service';
import { walletTxAr } from '../../core/i18n/ar-labels';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

@Component({
  selector: 'app-credit-ledger',
  imports: [CurrencyPipe, DatePipe, PercentPipe, FormsModule, AdminPager],
  templateUrl: './credit-ledger.html',
  styleUrl: './credit-ledger.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditLedger implements OnInit {
  private readonly api = inject(AdminCommerceService);

  protected readonly wallets = signal<AdminWallet[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = signal<AdminWallet | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly txPage = signal(1);
  protected readonly txTotalPages = signal(1);

  protected limitDraft = 0;
  protected paymentDraft = 0;
  protected paymentNote = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.wallets({ page: this.page(), limit: 20 }).subscribe({
      next: (res) => {
        this.wallets.set(res.items);
        this.page.set(res.page);
        this.totalPages.set(res.totalPages);
        this.total.set(res.total);
        this.loading.set(false);
        const sel = this.selected();
        if (sel) {
          const fresh = res.items.find((w) => w.id === sel.id);
          if (fresh) this.open(fresh);
          else this.loadSelectedWallet(this.shopId(sel));
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل دفاتر الائتمان');
      },
    });
  }

  protected goPage(next: number): void {
    const page = Math.min(this.totalPages(), Math.max(1, next));
    if (page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  protected goTxPage(next: number): void {
    const page = Math.min(this.txTotalPages(), Math.max(1, next));
    if (page === this.txPage()) return;
    this.txPage.set(page);
    const sel = this.selected();
    if (sel) this.loadSelectedWallet(this.shopId(sel));
  }

  protected shopName(w: AdminWallet): string {
    if (typeof w.shopId === 'object' && w.shopId) {
      return w.shopId.shopName || w.shopId.fullName || 'متجر';
    }
    return 'متجر';
  }

  protected shopMeta(w: AdminWallet): string {
    if (typeof w.shopId === 'object' && w.shopId) {
      return `${w.shopId.phone ?? ''} · ${w.shopId.city ?? ''}`;
    }
    return '';
  }

  protected shopId(w: AdminWallet): string {
    if (typeof w.shopId === 'object' && w.shopId) {
      return String(w.shopId.id || w.shopId._id || '');
    }
    return String(w.shopId);
  }

  protected txTypeLabel(type: string): string {
    return walletTxAr[type] ?? type;
  }

  protected open(w: AdminWallet): void {
    this.selected.set({ ...w, transactions: w.transactions ?? [] });
    this.limitDraft = w.creditLimit;
    this.paymentDraft = 0;
    this.paymentNote = '';
    this.txPage.set(1);
    this.loadSelectedWallet(this.shopId(w));
  }

  private loadSelectedWallet(shopId: string): void {
    if (!shopId) return;
    this.api.wallet(shopId, { page: this.txPage(), limit: 20 }).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.txPage.set(detail.transactionsMeta?.page ?? 1);
        this.txTotalPages.set(detail.transactionsMeta?.totalPages ?? 1);
        this.limitDraft = detail.creditLimit;
      },
      error: () => this.error.set('تعذر تحميل معاملات المحفظة'),
    });
  }

  protected saveLimit(): void {
    const w = this.selected();
    if (!w) return;
    this.api.setCreditLimit(this.shopId(w), Number(this.limitDraft)).subscribe({
      next: () => this.load(),
      error: (err: { error?: { message?: string } }) =>
        this.error.set(err.error?.message || 'فشل تحديث الحد'),
    });
  }

  protected savePayment(): void {
    const w = this.selected();
    if (!w || this.paymentDraft <= 0) return;
    this.api
      .recordPayment(this.shopId(w), Number(this.paymentDraft), this.paymentNote)
      .subscribe({
        next: () => this.load(),
        error: (err: { error?: { message?: string } }) =>
          this.error.set(err.error?.message || 'فشل تسجيل الدفعة'),
      });
  }
}
