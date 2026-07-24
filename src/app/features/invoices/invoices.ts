import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AdminInvoice,
  InvoiceStatus,
  InvoicesAdminService,
} from '../../core/invoices/invoices-admin.service';
import { AdminPager } from '../../shared/admin-pager/admin-pager';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-invoices-admin',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    AdminPager,
    ConfirmDialog,
  ],
  templateUrl: './invoices.html',
  styleUrl: './invoices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesAdminPage implements OnInit {
  private readonly api = inject(InvoicesAdminService);

  protected readonly invoices = signal<AdminInvoice[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<InvoiceStatus | ''>('');
  protected searchDraft = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly voidTarget = signal<AdminInvoice | null>(null);
  protected readonly voiding = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected statusLabel(status: string): string {
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

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list({
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
        status: this.statusFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.invoices.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل الفواتير');
        },
      });
  }

  protected onSearchInput(value: string): void {
    this.searchDraft = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      const next = value.trim();
      if (next === this.searchQuery()) return;
      this.searchQuery.set(next);
      this.page.set(1);
      this.load();
    }, 320);
  }

  protected clearSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft = '';
    if (!this.searchQuery()) return;
    this.searchQuery.set('');
    this.page.set(1);
    this.load();
  }

  protected setStatus(status: InvoiceStatus | ''): void {
    if (this.statusFilter() === status) return;
    this.statusFilter.set(status);
    this.page.set(1);
    this.load();
  }

  protected goPage(next: number): void {
    const page = Math.min(this.totalPages(), Math.max(1, next));
    if (page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  protected askVoid(inv: AdminInvoice): void {
    if (inv.status === 'VOID') return;
    this.voidTarget.set(inv);
  }

  protected confirmVoid(): void {
    const inv = this.voidTarget();
    if (!inv) return;
    this.voiding.set(true);
    this.api.void(inv.id).subscribe({
      next: () => {
        this.voiding.set(false);
        this.voidTarget.set(null);
        this.load();
      },
      error: () => {
        this.voiding.set(false);
        this.error.set('تعذر إلغاء الفاتورة');
      },
    });
  }
}
