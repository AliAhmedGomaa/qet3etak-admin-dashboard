import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
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
import { Brand } from '../../core/brands/brand.models';
import { BrandsAdminService } from '../../core/brands/brands-admin.service';
import { Category } from '../../core/categories/category.models';
import { CategoriesAdminService } from '../../core/categories/categories-admin.service';
import { qualityGradeAr } from '../../core/i18n/ar-labels';
import { environment } from '../../../environments/environment';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';
import {
  SearchableSelect,
  SearchOption,
} from '../../shared/searchable-select/searchable-select';
import { FileUpload } from '../../shared/file-upload/file-upload';

@Component({
  selector: 'app-inventory',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    ConfirmDialog,
    AdminPager,
    SearchableSelect,
    FileUpload,
  ],
  templateUrl: './inventory.html',
  styleUrl: './inventory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inventory implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ProductsAdminService);
  private readonly brandsApi = inject(BrandsAdminService);
  private readonly categoriesApi = inject(CategoriesAdminService);

  protected readonly products = signal<Product[]>([]);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly savingId = signal<string | null>(null);
  protected readonly editorOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly searchQuery = signal('');
  protected searchDraft = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly grades = QUALITY_GRADES;
  protected readonly gradeLabel = (g: string) => qualityGradeAr[g] ?? g;

  protected readonly brandOptions = computed<SearchOption[]>(() =>
    this.brands().map((b) => ({ value: b.name, label: b.name })),
  );
  protected readonly categoryOptions = computed<SearchOption[]>(() =>
    this.categories().map((c) => ({ value: c.name, label: c.name })),
  );
  protected readonly gradeOptions: SearchOption[] = QUALITY_GRADES.map((g) => ({
    value: g,
    label: qualityGradeAr[g] ?? g,
  }));
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly deleteTarget = signal<Product | null>(null);
  protected readonly deleting = signal(false);
  protected imageFile: File | null = null;

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    category: ['', Validators.required],
    part: [''],
    qualityGrade: this.fb.nonNullable.control<'Original' | 'HighCopy' | 'Copy' | 'Used'>(
      'Original',
      Validators.required,
    ),
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
    basePrice: [0, [Validators.required, Validators.min(0)]],
    sku: [''],
    isActive: [true],
    tieredPricing: this.fb.array([this.tierGroup(5, 0)]),
  });

  protected get tiers(): FormArray {
    return this.form.get('tieredPricing') as FormArray;
  }

  ngOnInit(): void {
    this.load();
    this.brandsApi.list({ page: 1, limit: 100 }).subscribe({
      next: (res) => this.brands.set(res.items.filter((b) => b.isActive)),
    });
    this.categoriesApi.list({ page: 1, limit: 100 }).subscribe({
      next: (res) => this.categories.set(res.items.filter((c) => c.isActive)),
    });
  }

  protected brandIcon(name: string): string {
    const brand = this.brands().find(
      (b) => b.name.toLowerCase() === name.toLowerCase(),
    );
    const url = brand?.iconUrl?.trim() ?? '';
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return `${environment.apiUrl}${url}`;
    return url;
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list({
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل المخزون');
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

  protected mediaUrl(url?: string | null): string {
    const value = url?.trim() ?? '';
    if (!value) return '';
    if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
      return value;
    }
    if (value.startsWith('/')) return `${environment.apiUrl}${value}`;
    return value;
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.imageFile = null;
    this.imagePreview.set(null);
    this.form.reset({
      title: '',
      brand: '',
      model: '',
      category: '',
      part: '',
      qualityGrade: 'Original',
      stockQuantity: 0,
      basePrice: 0,
      sku: '',
      isActive: true,
    });
    this.tiers.clear();
    this.editorOpen.set(true);
  }

  protected openEdit(product: Product): void {
    this.editingId.set(product.id);
    this.imageFile = null;
    this.imagePreview.set(this.mediaUrl(product.imageUrl) || null);
    this.form.patchValue({
      title: product.title,
      brand: product.brand,
      model: product.model,
      category: product.category,
      part: product.part ?? '',
      qualityGrade: product.qualityGrade,
      stockQuantity: product.stockQuantity,
      basePrice: product.basePrice,
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
    this.imageFile = null;
    this.imagePreview.set(null);
  }

  protected onImageSelected(file: File | null): void {
    this.imageFile = file;
    if (!file) this.imagePreview.set(null);
  }

  protected addTier(minQty = 10, price = 0): void {
    this.tiers.push(this.tierGroup(minQty, price));
  }

  protected removeTier(index: number): void {
    this.tiers.removeAt(index);
  }

  protected saveProduct(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('يرجى تعبئة جميع الحقول المطلوبة (العنوان، الماركة، الموديل، الفئة).');
      return;
    }

    const id = this.editingId();
    if (!id && !this.imageFile) {
      this.error.set('صورة المنتج مطلوبة');
      return;
    }

    const raw = this.form.getRawValue();
    const tiers = raw.tieredPricing
      .map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }))
      .sort((a, b) => a.minQty - b.minQty);

    this.savingId.set(id ?? 'new');
    this.error.set(null);

    if (this.imageFile || !id) {
      const fd = new FormData();
      fd.append('title', raw.title.trim());
      fd.append('brand', raw.brand.trim());
      fd.append('model', raw.model.trim());
      fd.append('category', raw.category.trim());
      if (raw.part.trim()) fd.append('part', raw.part.trim());
      fd.append('qualityGrade', raw.qualityGrade);
      fd.append('stockQuantity', String(raw.stockQuantity));
      fd.append('basePrice', String(raw.basePrice));
      fd.append('sku', raw.sku.trim());
      fd.append('isActive', String(raw.isActive));
      fd.append('tieredPricing', JSON.stringify(tiers));
      if (this.imageFile) fd.append('image', this.imageFile);

      const req = id ? this.api.update(id, fd) : this.api.create(fd);
      req.subscribe({
        next: () => {
          this.savingId.set(null);
          this.closeEditor();
          this.load();
        },
        error: (err) => {
          this.savingId.set(null);
          this.error.set(err?.error?.message ?? 'فشل الحفظ');
        },
      });
      return;
    }

    // Edit without replacing image — JSON patch
    this.api
      .update(id, {
        title: raw.title.trim(),
        brand: raw.brand.trim(),
        model: raw.model.trim(),
        category: raw.category.trim(),
        part: raw.part.trim() || undefined,
        qualityGrade: raw.qualityGrade,
        stockQuantity: Number(raw.stockQuantity),
        basePrice: Number(raw.basePrice),
        sku: raw.sku.trim(),
        isActive: raw.isActive,
        tieredPricing: tiers,
      })
      .subscribe({
        next: () => {
          this.savingId.set(null);
          this.closeEditor();
          this.load();
        },
        error: (err) => {
          this.savingId.set(null);
          this.error.set(err?.error?.message ?? 'فشل الحفظ');
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
    this.deleteTarget.set(product);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const product = this.deleteTarget();
    if (!product || this.deleting()) return;
    this.deleting.set(true);
    this.api.remove(product.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.error.set('فشل الحذف');
      },
    });
  }

  private tierGroup(minQty: number, price: number) {
    return this.fb.nonNullable.group({
      minQty: [minQty, [Validators.required, Validators.min(1)]],
      price: [price, [Validators.required, Validators.min(0)]],
    });
  }
}
