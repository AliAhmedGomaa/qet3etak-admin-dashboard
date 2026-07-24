import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShopUser } from '../../core/auth/auth.models';
import { ShopsAdminService } from '../../core/shops/shops-admin.service';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

@Component({
  selector: 'app-shop-approvals',
  imports: [DatePipe, FormsModule, AdminPager],
  templateUrl: './shop-approvals.html',
  styleUrl: './shop-approvals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopApprovals implements OnInit {
  private readonly shopsApi = inject(ShopsAdminService);

  protected readonly shops = signal<ShopUser[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);

  protected readonly rejectTarget = signal<ShopUser | null>(null);
  protected readonly previewSrc = signal<string | null>(null);
  protected rejectReason = '';

  protected readonly photoUrl = (path: string) => this.shopsApi.photoUrl(path);

  ngOnInit(): void {
    this.load();
  }

  protected openPreview(src: string): void {
    this.previewSrc.set(src);
  }

  protected closePreview(): void {
    this.previewSrc.set(null);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.shopsApi
      .list({ status: 'PENDING_VERIFICATION', page: this.page(), limit: 20 })
      .subscribe({
        next: (res) => {
          this.shops.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل المتاجر المعلقة');
        },
      });
  }

  protected goPage(next: number): void {
    const page = Math.min(this.totalPages(), Math.max(1, next));
    if (page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  protected approve(shop: ShopUser): void {
    this.busyId.set(shop.id);
    this.shopsApi.updateStatus(shop.id, 'APPROVED').subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.error.set('فشل الاعتماد');
      },
    });
  }

  protected openReject(shop: ShopUser): void {
    this.rejectTarget.set(shop);
    this.rejectReason = '';
  }

  protected closeReject(): void {
    this.rejectTarget.set(null);
    this.rejectReason = '';
  }

  protected confirmReject(): void {
    const shop = this.rejectTarget();
    if (!shop || this.rejectReason.trim().length < 3) return;

    this.busyId.set(shop.id);
    this.shopsApi
      .updateStatus(shop.id, 'REJECTED', this.rejectReason.trim())
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.closeReject();
          this.load();
        },
        error: () => {
          this.busyId.set(null);
          this.error.set('فشل الرفض');
        },
      });
  }
}
