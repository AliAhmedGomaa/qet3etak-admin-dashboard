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

@Component({
  selector: 'app-credit-ledger',
  imports: [CurrencyPipe, DatePipe, PercentPipe, FormsModule],
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

  protected limitDraft = 0;
  protected paymentDraft = 0;
  protected paymentNote = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.wallets().subscribe({
      next: (rows) => {
        this.wallets.set(rows);
        this.loading.set(false);
        const sel = this.selected();
        if (sel) {
          const fresh = rows.find((w) => w.id === sel.id);
          if (fresh) this.open(fresh);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل دفاتر الائتمان');
      },
    });
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
    this.selected.set(w);
    this.limitDraft = w.creditLimit;
    this.paymentDraft = 0;
    this.paymentNote = '';
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
