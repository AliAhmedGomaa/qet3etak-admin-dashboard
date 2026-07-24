import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminReturnRequest,
  ReturnRequestStatus,
  ReturnsAdminService,
} from '../../core/returns/returns-admin.service';
import { paymentMethodAr, returnStatusAr } from '../../core/i18n/ar-labels';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

@Component({
  selector: 'app-returns-admin',
  imports: [CurrencyPipe, DatePipe, FormsModule, AdminPager],
  templateUrl: './returns-admin.html',
  styleUrl: './returns-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReturnsAdmin implements OnInit {
  private readonly api = inject(ReturnsAdminService);

  protected readonly rows = signal<AdminReturnRequest[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly filter = signal<ReturnRequestStatus | ''>('PENDING');
  protected readonly detail = signal<AdminReturnRequest | null>(null);
  protected readonly rejectTarget = signal<AdminReturnRequest | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly searchQuery = signal('');
  protected searchDraft = '';
  protected rejectReason = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly statusLabel = (s: string) => returnStatusAr[s] ?? s;
  protected readonly paymentLabel = (s: string) => paymentMethodAr[s] ?? s;

  ngOnInit(): void {
    this.load();
  }

  protected setFilter(status: ReturnRequestStatus | ''): void {
    this.filter.set(status);
    this.page.set(1);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const status = this.filter() || undefined;
    this.api
      .list(status as ReturnRequestStatus | undefined, {
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
          this.api.refreshPendingCount();
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل المرتجعات');
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

  protected goPage(next: number): void {
    const page = Math.min(this.totalPages(), Math.max(1, next));
    if (page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  protected openDetail(row: AdminReturnRequest): void {
    this.detail.set(row);
  }

  protected closeDetail(): void {
    this.detail.set(null);
  }

  protected approve(row: AdminReturnRequest): void {
    this.busyId.set(row.id);
    this.api.approve(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.detail.set(null);
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.error.set('فشل اعتماد المرتجع');
      },
    });
  }

  protected openReject(row: AdminReturnRequest): void {
    this.rejectTarget.set(row);
    this.rejectReason = '';
  }

  protected closeReject(): void {
    this.rejectTarget.set(null);
    this.rejectReason = '';
  }

  protected confirmReject(): void {
    const row = this.rejectTarget();
    if (!row || this.rejectReason.trim().length < 3) return;
    this.busyId.set(row.id);
    this.api.reject(row.id, this.rejectReason.trim()).subscribe({
      next: () => {
        this.busyId.set(null);
        this.closeReject();
        this.detail.set(null);
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.error.set('فشل رفض المرتجع');
      },
    });
  }
}
