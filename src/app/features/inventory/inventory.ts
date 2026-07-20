import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Product, QUALITY_GRADES } from '../../core/products/product.models';
import { ProductsAdminService } from '../../core/products/products-admin.service';
import { qualityGradeAr } from '../../core/i18n/ar-labels';

@Component({
  selector: 'app-inventory',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inventory implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ProductsAdminService);

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly savingId = signal<string | null>(null);
  protected readonly editorOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly grades = QUALITY_GRADES;
  protected readonly gradeLabel = (g: string) => qualityGradeAr[g] ?? g;

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    category: ['', Validators.required],
    qualityGrade: this.fb.nonNullable.control<'Original' | 'HighCopy' | 'Copy' | 'Used'>(
      'Original',
      Validators.required,
    ),
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
    basePrice: [0, [Validators.required, Validators.min(0)]],
    imageUrl: [''],
    sku: [''],
    isActive: [true],
    tieredPricing: this.fb.array([this.tierGroup(5, 0)]),
  });

  protected get tiers(): FormArray {
    return this.form.get('tieredPricing') as FormArray;
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (rows) => {
        this.products.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل المخزون');
      },
    });
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      title: '',
      brand: '',
      model: '',
      category: '',
      qualityGrade: 'Original',
      stockQuantity: 0,
      basePrice: 0,
      imageUrl: '',
      sku: '',
      isActive: true,
    });
    this.tiers.clear();
    this.editorOpen.set(true);
  }

  protected openEdit(product: Product): void {
    this.editingId.set(product.id);
    this.form.patchValue({
      title: product.title,
      brand: product.brand,
      model: product.model,
      category: product.category,
      qualityGrade: product.qualityGrade,
      stockQuantity: product.stockQuantity,
      basePrice: product.basePrice,
      imageUrl: product.imageUrl ?? '',
      sku: product.sku ?? '',
      isActive: product.isActive ?? true,
    });
    this.tiers.clear();
    (product.tieredPricing ?? []).forEach((t) => this.addTier(t.minQty, t.price));
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
  }

  protected addTier(minQty = 10, price = 0): void {
    this.tiers.push(this.tierGroup(minQty, price));
  }

  protected removeTier(index: number): void {
    this.tiers.removeAt(index);
  }

  protected saveProduct(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const body = {
      ...raw,
      tieredPricing: raw.tieredPricing
        .map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }))
        .sort((a, b) => a.minQty - b.minQty),
    };
    const id = this.editingId();
    this.savingId.set(id ?? 'new');
    const req = id ? this.api.update(id, body) : this.api.create(body);
    req.subscribe({
      next: () => {
        this.savingId.set(null);
        this.closeEditor();
        this.load();
      },
      error: () => {
        this.savingId.set(null);
        this.error.set('فشل الحفظ');
      },
    });
  }

  protected inlinePatch(
    product: Product,
    patch: Partial<Pick<Product, 'stockQuantity' | 'basePrice'>>,
  ): void {
    this.savingId.set(product.id);
    this.api.update(product.id, patch).subscribe({
      next: (updated) => {
        this.savingId.set(null);
        this.products.update((list) =>
          list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
        );
      },
      error: () => {
        this.savingId.set(null);
        this.error.set('فشل التحديث السريع');
        this.load();
      },
    });
  }

  protected onStockBlur(product: Product, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 0 || value === product.stockQuantity) {
      return;
    }
    this.inlinePatch(product, { stockQuantity: value });
  }

  protected onPriceBlur(product: Product, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 0 || value === product.basePrice) {
      return;
    }
    this.inlinePatch(product, { basePrice: value });
  }

  protected remove(product: Product): void {
    if (!confirm(`حذف ${product.title}؟`)) return;
    this.api.remove(product.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('فشل الحذف'),
    });
  }

  private tierGroup(minQty: number, price: number) {
    return this.fb.nonNullable.group({
      minQty: [minQty, [Validators.required, Validators.min(1)]],
      price: [price, [Validators.required, Validators.min(0)]],
    });
  }
}
