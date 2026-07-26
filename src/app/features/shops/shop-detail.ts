import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopUser, UserStatus } from '../../core/auth/auth.models';
import { ShopsAdminService } from '../../core/shops/shops-admin.service';
import {
  AdminCommerceService,
  AdminWallet,
} from '../../core/commerce/admin-commerce.service';
import {
  AdminInvoice,
  InvoicesAdminService,
} from '../../core/invoices/invoices-admin.service';
import { walletTxAr } from '../../core/i18n/ar-labels';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_VERIFICATION: 'قيد المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  SUSPENDED: 'موقوف',
};

@Component({
  selector: 'app-shop-detail',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, AdminPager],
  templateUrl: './shop-detail.html',
  styleUrl: './shop-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly shopsApi = inject(ShopsAdminService);
  private readonly commerceApi = inject(AdminCommerceService);
  private readonly invoicesApi = inject(InvoicesAdminService);

  protected readonly shop = signal<ShopUser | null>(null);
  protected readonly wallet = signal<AdminWallet | null>(null);
  protected readonly invoices = signal<AdminInvoice[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly paymentBusy = signal(false);
  protected readonly paymentError = signal<string | null>(null);
  protected readonly paymentSuccess = signal<string | null>(null);

  protected readonly txPage = signal(1);
  protected readonly txTotalPages = signal(1);
  protected readonly invPage = signal(1);
  protected readonly invTotalPages = signal(1);
  protected readonly invTotal = signal(0);

  protected paymentDraft = 0;
  protected paymentNote = '';
  protected discountDraft = 0;
  protected readonly discountBusy = signal(false);
  protected readonly discountError = signal<string | null>(null);
  protected readonly discountSuccess = signal<string | null>(null);

  private shopId = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set('معرّف المتجر غير موجود');
      return;
    }
    this.shopId = id;
    this.reloadAll();
  }

  protected statusLabel(status: UserStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected txTypeLabel(type: string): string {
    return walletTxAr[type] ?? type;
  }

  protected invoiceStatusLabel(status: string): string {
    const map: Record<string, string> = {
      ISSUED: 'صادرة',
      PAID: 'مدفوعة',
      VOID: 'ملغاة',
    };
    return map[status] ?? status;
  }

  protected paymentLabel(method: string): string {
    return method === 'CREDIT' ? 'آجل' : 'عند الاستلام';
  }

  protected reloadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shopsApi.get(this.shopId).subscribe({
      next: (shop) => {
        this.shop.set(shop);
        this.discountDraft = shop.shopDiscountPercent ?? 0;
        this.loadWallet();
        this.loadInvoices();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل بيانات المتجر');
      },
    });
  }

  protected saveDiscount(): void {
    const value = Number(this.discountDraft);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      this.discountError.set('أدخل نسبة بين 0 و 100');
      return;
    }
    this.discountBusy.set(true);
    this.discountError.set(null);
    this.discountSuccess.set(null);
    this.shopsApi
      .update(this.shopId, { shopDiscountPercent: value })
      .subscribe({
        next: (shop) => {
          this.shop.set(shop);
          this.discountDraft = shop.shopDiscountPercent ?? 0;
          this.discountBusy.set(false);
          this.discountSuccess.set('تم حفظ خصم المتجر.');
        },
        error: () => {
          this.discountBusy.set(false);
          this.discountError.set('تعذر حفظ الخصم');
        },
      });
  }

  protected goTxPage(next: number): void {
    const page = Math.min(this.txTotalPages(), Math.max(1, next));
    if (page === this.txPage()) return;
    this.txPage.set(page);
    this.loadWallet();
  }

  protected goInvPage(next: number): void {
    const page = Math.min(this.invTotalPages(), Math.max(1, next));
    if (page === this.invPage()) return;
    this.invPage.set(page);
    this.loadInvoices();
  }

  protected savePayment(): void {
    const amount = Number(this.paymentDraft);
    const debt = this.wallet()?.currentDebt ?? 0;
    if (!amount || amount <= 0) {
      this.paymentError.set('أدخل مبلغاً أكبر من صفر');
      return;
    }
    if (amount > debt) {
      this.paymentError.set('المبلغ أكبر من الدين المستحق');
      return;
    }
    this.paymentBusy.set(true);
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    this.commerceApi
      .recordPayment(this.shopId, amount, this.paymentNote.trim() || undefined)
      .subscribe({
        next: (wallet) => {
          this.wallet.set(wallet);
          this.txPage.set(wallet.transactionsMeta?.page ?? 1);
          this.txTotalPages.set(wallet.transactionsMeta?.totalPages ?? 1);
          this.paymentDraft = 0;
          this.paymentNote = '';
          this.paymentBusy.set(false);
          this.paymentSuccess.set('تم تسجيل الدفعة بنجاح');
          this.loadWallet();
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          this.paymentBusy.set(false);
          const msg = err.error?.message;
          this.paymentError.set(
            Array.isArray(msg)
              ? msg.join(' · ')
              : typeof msg === 'string'
                ? msg
                : 'فشل تسجيل الدفعة',
          );
        },
      });
  }

  private loadWallet(): void {
    this.commerceApi
      .wallet(this.shopId, { page: this.txPage(), limit: 20 })
      .subscribe({
        next: (wallet) => {
          this.wallet.set(wallet);
          this.txPage.set(wallet.transactionsMeta?.page ?? 1);
          this.txTotalPages.set(wallet.transactionsMeta?.totalPages ?? 1);
        },
        error: () => {
          this.wallet.set(null);
          this.error.set('تعذر تحميل محفظة المتجر');
        },
      });
  }

  private loadInvoices(): void {
    this.invoicesApi
      .list({ page: this.invPage(), limit: 20, shopId: this.shopId })
      .subscribe({
        next: (res) => {
          this.invoices.set(res.items);
          this.invPage.set(res.page);
          this.invTotalPages.set(res.totalPages);
          this.invTotal.set(res.total);
        },
        error: () => this.error.set('تعذر تحميل فواتير المتجر'),
      });
  }
}
