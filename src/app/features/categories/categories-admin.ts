import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Category } from '../../core/categories/category.models';
import { CategoriesAdminService } from '../../core/categories/categories-admin.service';
import { environment } from '../../../environments/environment';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';
import { FileUpload } from '../../shared/file-upload/file-upload';

@Component({
  selector: 'app-categories-admin',
  imports: [ReactiveFormsModule, ConfirmDialog, AdminPager, FileUpload],
  templateUrl: './categories-admin.html',
  styleUrl: './categories-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CategoriesAdminService);

  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editorOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly iconPreview = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly searchQuery = signal('');
  protected searchDraft = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly deleteTarget = signal<Category | null>(null);
  protected readonly deleting = signal(false);
  protected iconFile: File | null = null;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    iconUrl: [''],
    sortOrder: [0],
    isActive: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .list({ page: this.page(), limit: 20, q: this.searchQuery() || undefined })
      .subscribe({
        next: (res) => {
          this.categories.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل الفئات');
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

  protected iconSrc(category: Category): string {
    const url = category.iconUrl?.trim();
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return `${environment.apiUrl}${url}`;
    return url;
  }

  protected initial(name: string): string {
    return (name.trim().charAt(0) || '?').toUpperCase();
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.iconFile = null;
    this.iconPreview.set(null);
    this.form.reset({ name: '', iconUrl: '', sortOrder: 0, isActive: true });
    this.editorOpen.set(true);
  }

  protected openEdit(category: Category): void {
    this.editingId.set(category.id);
    this.iconFile = null;
    this.iconPreview.set(this.iconSrc(category) || null);
    this.form.patchValue({
      name: category.name,
      iconUrl: category.iconUrl ?? '',
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
    });
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.iconFile = null;
    this.iconPreview.set(null);
  }

  protected onIconSelected(file: File | null): void {
    this.iconFile = file;
    if (!file) this.iconPreview.set(null);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    const id = this.editingId();
    const req$ =
      this.iconFile != null
        ? (() => {
            const fd = new FormData();
            fd.append('name', raw.name.trim());
            fd.append('iconUrl', raw.iconUrl.trim());
            fd.append('sortOrder', String(raw.sortOrder ?? 0));
            fd.append('isActive', String(raw.isActive));
            fd.append('icon', this.iconFile!);
            return id ? this.api.update(id, fd) : this.api.create(fd);
          })()
        : (() => {
            const body = {
              name: raw.name.trim(),
              iconUrl: raw.iconUrl.trim(),
              sortOrder: Number(raw.sortOrder) || 0,
              isActive: raw.isActive,
            };
            return id ? this.api.update(id, body) : this.api.create(body);
          })();

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditor();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'فشل حفظ الفئة');
      },
    });
  }

  protected remove(category: Category): void {
    this.deleteTarget.set(category);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const category = this.deleteTarget();
    if (!category || this.deleting()) return;
    this.deleting.set(true);
    this.api.remove(category.id).subscribe({
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

  protected toggleActive(category: Category): void {
    this.api.update(category.id, { isActive: !category.isActive }).subscribe({
      next: () => this.load(),
      error: () => this.error.set('فشل تحديث الحالة'),
    });
  }
}
