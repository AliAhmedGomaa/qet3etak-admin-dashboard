import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ShopUser, UserStatus } from '../../core/auth/auth.models';
import { ShopsAdminService } from '../../core/shops/shops-admin.service';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_VERIFICATION: 'قيد المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
};

@Component({
  selector: 'app-shops-admin',
  imports: [ReactiveFormsModule, DatePipe, ConfirmDialog, AdminPager],
  templateUrl: './shops-admin.html',
  styleUrl: './shops-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopsAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ShopsAdminService);

  protected readonly shops = signal<ShopUser[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editorOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly searchQuery = signal('');
  protected searchDraft = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly statusFilter = signal<UserStatus | ''>('');
  protected readonly deleteTarget = signal<ShopUser | null>(null);
  protected readonly deleting = signal(false);
  protected readonly previewSrc = signal<string | null>(null);

  protected readonly statusOptions: Array<{ value: UserStatus | ''; label: string }> =
    [
      { value: '', label: 'الكل' },
      { value: 'PENDING_VERIFICATION', label: STATUS_LABELS.PENDING_VERIFICATION },
      { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
      { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
    ];

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    shopName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(5)]],
    password: [''],
    commercialRegPhotoUrl: [''],
    status: this.fb.nonNullable.control<UserStatus>('APPROVED'),
    rejectionReason: [''],
  });

  protected readonly photoUrl = (path: string) => this.api.photoUrl(path);

  ngOnInit(): void {
    this.load();
  }

  protected statusLabel(status: UserStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const status = this.statusFilter();
    this.api
      .list({
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
        status: status || undefined,
      })
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
          this.error.set('تعذر تحميل المتاجر');
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

  protected setStatusFilter(value: UserStatus | ''): void {
    if (value === this.statusFilter()) return;
    this.statusFilter.set(value);
    this.page.set(1);
    this.load();
  }

  protected goPage(next: number): void {
    const page = Math.min(this.totalPages(), Math.max(1, next));
    if (page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      fullName: '',
      shopName: '',
      phone: '',
      city: '',
      address: '',
      password: '',
      commercialRegPhotoUrl: '',
      status: 'APPROVED',
      rejectionReason: '',
    });
    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(6),
    ]);
    this.form.controls.password.updateValueAndValidity();
    this.editorOpen.set(true);
  }

  protected openEdit(shop: ShopUser): void {
    this.editingId.set(shop.id);
    this.form.reset({
      fullName: shop.fullName,
      shopName: shop.shopName,
      phone: shop.phone,
      city: shop.city,
      address: shop.address,
      password: '',
      commercialRegPhotoUrl: shop.commercialRegPhotoUrl || '',
      status: shop.status,
      rejectionReason: shop.rejectionReason || '',
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.setValidators([Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
  }

  protected openPreview(src: string): void {
    if (!src) return;
    this.previewSrc.set(src);
  }

  protected closePreview(): void {
    this.previewSrc.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (
      value.status === 'REJECTED' &&
      value.rejectionReason.trim().length < 3
    ) {
      this.error.set('سبب الرفض مطلوب (٣ أحرف على الأقل)');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload = {
      fullName: value.fullName.trim(),
      shopName: value.shopName.trim(),
      phone: value.phone.trim(),
      city: value.city.trim(),
      address: value.address.trim(),
      commercialRegPhotoUrl: value.commercialRegPhotoUrl.trim() || undefined,
      status: value.status,
      rejectionReason:
        value.status === 'REJECTED'
          ? value.rejectionReason.trim()
          : undefined,
      ...(value.password.trim()
        ? { password: value.password.trim() }
        : {}),
    };

    const req = this.editingId()
      ? this.api.update(this.editingId()!, payload)
      : this.api.create({ ...payload, password: value.password.trim() });

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditor();
        this.load();
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.saving.set(false);
        const msg = err.error?.message;
        this.error.set(
          Array.isArray(msg)
            ? msg.join(' · ')
            : typeof msg === 'string'
              ? msg
              : 'تعذر حفظ المتجر',
        );
      },
    });
  }

  protected setStatus(shop: ShopUser, status: UserStatus): void {
    if (status === 'REJECTED') {
      this.openEdit(shop);
      this.form.patchValue({ status: 'REJECTED' });
      return;
    }
    this.api.updateStatus(shop.id, status).subscribe({
      next: () => this.load(),
      error: () => this.error.set('تعذر تحديث حالة المتجر'),
    });
  }

  protected remove(shop: ShopUser): void {
    this.deleteTarget.set(shop);
  }

  protected confirmDelete(): void {
    const shop = this.deleteTarget();
    if (!shop) return;
    this.deleting.set(true);
    this.api.remove(shop.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.deleting.set(false);
        const msg = err.error?.message;
        this.error.set(
          Array.isArray(msg)
            ? msg.join(' · ')
            : typeof msg === 'string'
              ? msg
              : 'تعذر حذف المتجر',
        );
        this.deleteTarget.set(null);
      },
    });
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
  }
}
