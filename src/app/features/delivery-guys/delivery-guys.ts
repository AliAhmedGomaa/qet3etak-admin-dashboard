import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  DeliveryFeeModel,
  DeliveryGuy,
  DeliveryGuyInput,
  DeliveryGuysAdminService,
} from '../../core/delivery/delivery-guys-admin.service';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

const FEE_LABELS: Record<DeliveryFeeModel, string> = {
  FLAT: 'مبلغ ثابت لكل توصيلة',
  PERCENT: 'نسبة من قيمة الطلب',
  BASE_PLUS_ITEMS: 'أساسي + لكل قطعة',
  HOURLY: 'أجر بالساعة (وقت العمل)',
};

const FEE_HINTS: Record<DeliveryFeeModel, string> = {
  FLAT: 'يُحسب مبلغ ثابت عن كل طلب يتم توصيله.',
  PERCENT: 'نسبة مئوية من إجمالي قيمة الطلب.',
  BASE_PLUS_ITEMS: 'أجر أساسي للطلب + مبلغ إضافي عن كل قطعة.',
  HOURLY:
    'أجر حسب ساعات الحضور من تسجيل الدخول حتى الانصراف — ليس عن كل توصيلة.',
};

@Component({
  selector: 'app-delivery-guys',
  imports: [ReactiveFormsModule, CurrencyPipe, ConfirmDialog, AdminPager],
  templateUrl: './delivery-guys.html',
  styleUrl: './delivery-guys.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryGuysPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(DeliveryGuysAdminService);

  protected readonly guys = signal<DeliveryGuy[]>([]);
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
  protected readonly deleteTarget = signal<DeliveryGuy | null>(null);
  protected readonly deleting = signal(false);
  protected readonly feePreview = signal<number | null>(null);
  protected readonly editorError = signal<string | null>(null);
  protected readonly selectedFeeModel = signal<DeliveryFeeModel>('FLAT');

  protected readonly feeModels: Array<{ value: DeliveryFeeModel; label: string }> =
    [
      { value: 'FLAT', label: FEE_LABELS.FLAT },
      { value: 'PERCENT', label: FEE_LABELS.PERCENT },
      { value: 'BASE_PLUS_ITEMS', label: FEE_LABELS.BASE_PLUS_ITEMS },
      { value: 'HOURLY', label: FEE_LABELS.HOURLY },
    ];

  protected feeHint(model: DeliveryFeeModel): string {
    return FEE_HINTS[model];
  }

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    password: [''],
    city: [''],
    vehicleType: [''],
    notes: [''],
    status: this.fb.nonNullable.control<'ACTIVE' | 'INACTIVE'>('ACTIVE'),
    feeModel: this.fb.nonNullable.control<DeliveryFeeModel>('FLAT'),
    flatFee: [30, [Validators.min(0)]],
    percentRate: [0, [Validators.min(0)]],
    baseFee: [20, [Validators.min(0)]],
    perItemFee: [2, [Validators.min(0)]],
    hourlyRate: [25, [Validators.min(0)]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected feeLabel(model: DeliveryFeeModel): string {
    return FEE_LABELS[model] ?? model;
  }

  protected feeSummary(guy: DeliveryGuy): string {
    switch (guy.feeModel) {
      case 'PERCENT':
        return `${guy.percentRate}% من الطلب`;
      case 'BASE_PLUS_ITEMS':
        return `${guy.baseFee} + ${guy.perItemFee}×قطعة`;
      case 'HOURLY':
        return `${guy.hourlyRate} ج.م / ساعة`;
      default:
        return `${guy.flatFee} ج.م / توصيلة`;
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list({
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
        includeInactive: true,
      })
      .subscribe({
        next: (res) => {
          this.guys.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل مندوبي التوصيل');
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

  protected openCreate(): void {
    this.editingId.set(null);
    this.feePreview.set(null);
    this.editorError.set(null);
    this.selectedFeeModel.set('FLAT');
    this.form.reset({
      fullName: '',
      phone: '',
      password: '',
      city: '',
      vehicleType: '',
      notes: '',
      status: 'ACTIVE',
      feeModel: 'FLAT',
      flatFee: 30,
      percentRate: 0,
      baseFee: 20,
      perItemFee: 2,
      hourlyRate: 25,
    });
    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(6),
    ]);
    this.form.controls.password.updateValueAndValidity();
    this.editorOpen.set(true);
  }

  protected openEdit(guy: DeliveryGuy): void {
    this.editingId.set(guy.id);
    this.feePreview.set(null);
    this.editorError.set(null);
    const model = guy.feeModel || 'FLAT';
    this.selectedFeeModel.set(model);
    this.form.patchValue({
      fullName: guy.fullName,
      phone: guy.phone,
      password: '',
      city: guy.city ?? '',
      vehicleType: guy.vehicleType ?? '',
      notes: guy.notes ?? '',
      status: guy.status,
      feeModel: model,
      flatFee: Number(guy.flatFee) || 0,
      percentRate: Number(guy.percentRate) || 0,
      baseFee: Number(guy.baseFee) || 0,
      perItemFee: Number(guy.perItemFee) || 0,
      hourlyRate: Number(guy.hourlyRate) > 0 ? Number(guy.hourlyRate) : 25,
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.setValidators([Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.editorError.set(null);
  }

  protected onFeeModelChange(value: string): void {
    const model = value as DeliveryFeeModel;
    this.selectedFeeModel.set(model);
    this.feePreview.set(null);
    this.editorError.set(null);
  }

  protected previewFee(): void {
    const v = this.form.getRawValue();
    let fee = 0;
    if (v.feeModel === 'PERCENT') fee = (1500 * (Number(v.percentRate) || 0)) / 100;
    else if (v.feeModel === 'BASE_PLUS_ITEMS')
      fee = (Number(v.baseFee) || 0) + 5 * (Number(v.perItemFee) || 0);
    else if (v.feeModel === 'HOURLY') fee = Number(v.hourlyRate) || 0;
    else fee = Number(v.flatFee) || 0;
    this.feePreview.set(Number(fee.toFixed(2)));
  }

  protected save(): void {
    this.editorError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.editorError.set('راجع الحقول المطلوبة ثم حاول مرة أخرى');
      return;
    }
    const value = this.form.getRawValue();
    const feeModel = value.feeModel;
    const hourlyRate = Number(value.hourlyRate) || 0;
    if (feeModel === 'HOURLY' && hourlyRate <= 0) {
      this.editorError.set('يجب تحديد سعر الساعة (ج.م) أكبر من صفر');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const payload: Partial<DeliveryGuyInput> & {
      fullName: string;
      phone: string;
    } = {
      fullName: value.fullName.trim(),
      phone: value.phone.trim(),
      city: value.city.trim(),
      vehicleType: value.vehicleType.trim(),
      notes: value.notes.trim(),
      status: value.status,
      feeModel,
      flatFee: Number(value.flatFee) || 0,
      percentRate: Number(value.percentRate) || 0,
      baseFee: Number(value.baseFee) || 0,
      perItemFee: Number(value.perItemFee) || 0,
      hourlyRate,
    };
    if (value.password.trim()) {
      payload.password = value.password.trim();
    }
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
        const text = Array.isArray(msg)
          ? msg.join(' · ')
          : typeof msg === 'string'
            ? msg
            : 'تعذر حفظ المندوب';
        this.editorError.set(text);
        this.error.set(text);
      },
    });
  }

  protected toggleStatus(guy: DeliveryGuy): void {
    const next = guy.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.api.update(guy.id, { status: next }).subscribe({
      next: () => this.load(),
      error: () => this.error.set('تعذر تحديث الحالة'),
    });
  }

  protected remove(guy: DeliveryGuy): void {
    this.deleteTarget.set(guy);
  }

  protected confirmDelete(): void {
    const guy = this.deleteTarget();
    if (!guy) return;
    this.deleting.set(true);
    this.api.remove(guy.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.error.set('تعذر حذف المندوب');
      },
    });
  }
}
