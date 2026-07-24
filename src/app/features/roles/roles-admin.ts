import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AdminRole } from '../../core/roles/role.models';
import { RolesAdminService } from '../../core/roles/roles-admin.service';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

@Component({
  selector: 'app-roles-admin',
  imports: [ReactiveFormsModule, ConfirmDialog, AdminPager],
  templateUrl: './roles-admin.html',
  styleUrl: './roles-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RolesAdminService);

  protected readonly roles = signal<AdminRole[]>([]);
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
  protected readonly deleteTarget = signal<AdminRole | null>(null);
  protected readonly deleting = signal(false);
  protected readonly permissions = signal<string[]>([]);
  protected readonly permissionDraft = signal('');

  protected readonly editingSystem = computed(() => {
    const id = this.editingId();
    if (!id) return false;
    return !!this.roles().find((r) => r.id === id)?.isSystem;
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    code: [
      '',
      [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]{1,31}$/)],
    ],
    description: [''],
    adminPanel: [true],
    isActive: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
        includeInactive: true,
      })
      .subscribe({
        next: (res) => {
          this.roles.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل الأدوار');
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
    this.permissions.set(['admin.panel']);
    this.permissionDraft.set('');
    this.form.reset({
      name: '',
      code: '',
      description: '',
      adminPanel: true,
      isActive: true,
    });
    this.form.controls.code.enable();
    this.editorOpen.set(true);
  }

  protected openEdit(role: AdminRole): void {
    this.editingId.set(role.id);
    this.permissions.set([...(role.permissions ?? [])]);
    this.permissionDraft.set('');
    this.form.reset({
      name: role.name,
      code: role.code,
      description: role.description ?? '',
      adminPanel: role.adminPanel,
      isActive: role.isActive,
    });
    if (role.isSystem) {
      this.form.controls.code.disable();
    } else {
      this.form.controls.code.enable();
    }
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.permissions.set([]);
    this.permissionDraft.set('');
    this.form.controls.code.enable();
  }

  protected addPermission(): void {
    const parts = this.permissionDraft()
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;

    const next = [...this.permissions()];
    for (const part of parts) {
      if (!next.includes(part)) next.push(part);
    }
    this.permissions.set(next);
    this.permissionDraft.set('');
  }

  protected removePermission(permission: string): void {
    this.permissions.update((list) => list.filter((p) => p !== permission));
  }

  protected onPermissionKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addPermission();
      return;
    }
    if (
      event.key === 'Backspace' &&
      !this.permissionDraft() &&
      this.permissions().length
    ) {
      event.preventDefault();
      this.permissions.update((list) => list.slice(0, -1));
    }
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const permissions = this.permissions();

    this.saving.set(true);
    this.error.set(null);
    const id = this.editingId();
    const isSystem = this.editingSystem();

    const req$ = id
      ? this.api.update(id, {
          name: raw.name.trim(),
          description: raw.description.trim(),
          permissions,
          adminPanel: raw.adminPanel,
          isActive: isSystem ? true : raw.isActive,
          ...(isSystem ? {} : { code: raw.code.trim().toUpperCase() }),
        })
      : this.api.create({
          name: raw.name.trim(),
          code: raw.code.trim().toUpperCase(),
          description: raw.description.trim(),
          permissions,
          adminPanel: raw.adminPanel,
          isActive: raw.isActive,
        });

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditor();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'فشل حفظ الدور');
      },
    });
  }

  protected remove(role: AdminRole): void {
    if (role.isSystem) {
      this.error.set('لا يمكن حذف أدوار النظام');
      return;
    }
    this.deleteTarget.set(role);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const role = this.deleteTarget();
    if (!role || this.deleting()) return;
    this.deleting.set(true);
    this.api.remove(role.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err?.error?.message ?? 'فشل الحذف');
      },
    });
  }
}
