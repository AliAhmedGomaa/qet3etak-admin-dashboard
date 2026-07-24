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
import { Quality } from '../../core/qualities/quality.models';
import { QualitiesAdminService } from '../../core/qualities/qualities-admin.service';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

@Component({
  selector: 'app-qualities-admin',
  imports: [ReactiveFormsModule, ConfirmDialog, AdminPager],
  templateUrl: './qualities-admin.html',
  styleUrl: './qualities-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualitiesAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(QualitiesAdminService);

  protected readonly qualities = signal<Quality[]>([]);
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
  protected readonly deleteTarget = signal<Quality | null>(null);
  protected readonly deleting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    code: [''],
    description: [''],
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
          this.qualities.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل درجات الجودة');
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
    this.form.reset({
      name: '',
      code: '',
      description: '',
      sortOrder: 0,
      isActive: true,
    });
    this.editorOpen.set(true);
  }

  protected openEdit(quality: Quality): void {
    this.editingId.set(quality.id);
    this.form.patchValue({
      name: quality.name,
      code: quality.code ?? '',
      description: quality.description ?? '',
      sortOrder: quality.sortOrder ?? 0,
      isActive: quality.isActive ?? true,
    });
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    const body: Partial<Quality> = {
      name: raw.name.trim(),
      description: raw.description.trim(),
      sortOrder: Number(raw.sortOrder) || 0,
      isActive: raw.isActive,
    };
    if (raw.code.trim()) body.code = raw.code.trim();

    const id = this.editingId();
    const req$ = id ? this.api.update(id, body) : this.api.create(body);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditor();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'فشل حفظ درجة الجودة');
      },
    });
  }

  protected remove(quality: Quality): void {
    this.deleteTarget.set(quality);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const quality = this.deleteTarget();
    if (!quality || this.deleting()) return;
    this.deleting.set(true);
    this.api.remove(quality.id).subscribe({
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

  protected toggleActive(quality: Quality): void {
    this.api.update(quality.id, { isActive: !quality.isActive }).subscribe({
      next: () => this.load(),
      error: () => this.error.set('فشل تحديث الحالة'),
    });
  }
}
