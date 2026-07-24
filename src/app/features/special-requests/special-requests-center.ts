import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminSpecialRequest,
  AdminSpecialRequestsApi,
  SpecialRequestStatus,
} from '../../core/special-requests/admin-special-requests.api';
import { specialStatusAr } from '../../core/i18n/ar-labels';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

@Component({
  selector: 'app-special-requests-center',
  imports: [CurrencyPipe, FormsModule, AdminPager],
  templateUrl: './special-requests-center.html',
  styleUrl: './special-requests-center.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecialRequestsCenter implements OnInit {
  private readonly api = inject(AdminSpecialRequestsApi);

  protected readonly rows = signal<AdminSpecialRequest[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<SpecialRequestStatus | ''>('PENDING');
  protected readonly selected = signal<AdminSpecialRequest | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly searchQuery = signal('');
  protected searchDraft = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected quotePrice = 0;
  protected estimatedArrival = '';
  protected adminReply = '';

  protected readonly photoUrl = (p: string) => this.api.photoUrl(p);
  protected readonly statusLabel = (s: string) => specialStatusAr[s] ?? s;

  ngOnInit(): void {
    this.load();
  }

  protected setFilter(status: SpecialRequestStatus | ''): void {
    this.filter.set(status);
    this.page.set(1);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const status = this.filter() || undefined;
    this.api
      .list(status as SpecialRequestStatus | undefined, {
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
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل الطلبات الخاصة');
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

  protected open(row: AdminSpecialRequest): void {
    this.selected.set(row);
    this.quotePrice = row.quotePrice ?? row.targetPrice;
    this.estimatedArrival = row.estimatedArrival
      ? row.estimatedArrival.slice(0, 10)
      : '';
    this.adminReply = row.adminReply ?? '';
  }

  protected sendQuote(): void {
    const row = this.selected();
    if (!row) return;
    this.api
      .quote(row.id, {
        quotePrice: Number(this.quotePrice),
        estimatedArrival: this.estimatedArrival || undefined,
        adminReply: this.adminReply.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.selected.set(null);
          this.load();
        },
        error: () => this.error.set('فشل إرسال العرض'),
      });
  }

  protected markFulfilled(row: AdminSpecialRequest): void {
    this.api.fulfill(row.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('فشل تحديث الحالة'),
    });
  }
}
