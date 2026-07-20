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

@Component({
  selector: 'app-shop-approvals',
  imports: [DatePipe, FormsModule],
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
    this.shopsApi.list('PENDING_VERIFICATION').subscribe({
      next: (rows) => {
        this.shops.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل المتاجر المعلقة');
      },
    });
  }

  protected approve(shop: ShopUser): void {
    this.busyId.set(shop.id);
    this.shopsApi.updateStatus(shop.id, 'APPROVED').subscribe({
      next: () => {
        this.busyId.set(null);
        this.shops.update((list) => list.filter((s) => s.id !== shop.id));
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
          this.shops.update((list) => list.filter((s) => s.id !== shop.id));
        },
        error: () => {
          this.busyId.set(null);
          this.error.set('فشل الرفض');
        },
      });
  }
}
