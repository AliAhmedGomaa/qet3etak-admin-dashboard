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
import { AuthService } from '../../core/auth/auth.service';
import { AdminUsersService } from '../../core/users/admin-users.service';
import {
  AdminRoleDefinition,
  AdminUser,
  AdminUserRole,
  AssignableAdminUserRole,
} from '../../core/users/user.models';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

const ROLE_LABELS: Record<AdminUserRole, string> = {
  ADMIN: 'مدير النظام',
  MANAGER: 'مدير عمليات',
  STAFF: 'موظف',
  BRANCH_MANAGER: 'مدير فرع',
};

@Component({
  selector: 'app-users-admin',
  imports: [ReactiveFormsModule, ConfirmDialog, AdminPager],
  templateUrl: './users-admin.html',
  styleUrl: './users-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminUsersService);
  private readonly auth = inject(AuthService);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly roles = signal<AdminRoleDefinition[]>([]);
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
  protected readonly roleFilter = signal<AdminUserRole | ''>('');
  protected readonly deleteTarget = signal<AdminUser | null>(null);
  protected readonly deleting = signal(false);

  protected readonly canAssignAdmin = computed(
    () => this.auth.user()?.role === 'ADMIN',
  );

  protected readonly assignableRoles = computed(() => {
    const all = this.roles().filter((r) => r.role !== 'BRANCH_MANAGER');
    if (this.canAssignAdmin()) return all;
    return all.filter((r) => r.role !== 'ADMIN');
  });

  protected readonly editingBranchManager = computed(() => {
    const id = this.editingId();
    if (!id) return false;
    return this.users().find((u) => u.id === id)?.role === 'BRANCH_MANAGER';
  });

  protected readonly formRoleOptions = computed(() => {
    if (!this.editingBranchManager()) return this.assignableRoles();
    const bm = this.roles().find((r) => r.role === 'BRANCH_MANAGER');
    return bm ? [bm] : this.assignableRoles();
  });

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s]{8,20}$/)]],
    password: ['', [Validators.minLength(6)]],
    role: ['STAFF' as AdminUserRole, Validators.required],
    isActive: [true],
  });

  ngOnInit(): void {
    this.api.listRoles().subscribe({
      next: (res) => this.roles.set(res.items),
      error: () => {
        this.roles.set([
          {
            role: 'ADMIN',
            labelAr: 'مدير النظام',
            labelEn: 'Admin',
            descriptionAr: 'صلاحيات كاملة',
            canAccessAdmin: true,
          },
          {
            role: 'MANAGER',
            labelAr: 'مدير عمليات',
            labelEn: 'Manager',
            descriptionAr: 'وصول للوحة الإدارة',
            canAccessAdmin: true,
          },
          {
            role: 'STAFF',
            labelAr: 'موظف',
            labelEn: 'Staff',
            descriptionAr: 'وصول للوحة الإدارة',
            canAccessAdmin: true,
          },
          {
            role: 'BRANCH_MANAGER',
            labelAr: 'مدير فرع',
            labelEn: 'Branch manager',
            descriptionAr: 'يُعيَّن من صفحة الفروع',
            canAccessAdmin: true,
          },
        ]);
      },
    });
    this.load();
  }

  protected roleLabel(role: AdminUserRole): string {
    return (
      this.roles().find((r) => r.role === role)?.labelAr ??
      ROLE_LABELS[role] ??
      role
    );
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .list({
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
        role: this.roleFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل المستخدمين');
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

  protected onRoleFilter(value: string): void {
    const next = (value || '') as AdminUserRole | '';
    if (next === this.roleFilter()) return;
    this.roleFilter.set(next);
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
      phone: '',
      password: '',
      role: 'STAFF',
      isActive: true,
    });
    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(6),
    ]);
    this.form.controls.password.updateValueAndValidity();
    this.editorOpen.set(true);
  }

  protected openEdit(user: AdminUser): void {
    this.editingId.set(user.id);
    this.form.reset({
      fullName: user.fullName,
      phone: user.phone,
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    this.form.controls.password.setValidators([Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
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
    if (!this.canAssignAdmin() && raw.role === 'ADMIN') {
      this.error.set('فقط مدير النظام يمكنه تعيين دور المدير');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const id = this.editingId();
    const isBranchManager = this.editingBranchManager();

    const req$ = id
      ? this.api.update(id, {
          fullName: raw.fullName.trim(),
          phone: raw.phone.trim(),
          isActive: raw.isActive,
          ...(isBranchManager ? {} : { role: raw.role as AssignableAdminUserRole }),
          ...(raw.password.trim()
            ? { password: raw.password.trim() }
            : {}),
        })
      : this.api.create({
          fullName: raw.fullName.trim(),
          phone: raw.phone.trim(),
          password: raw.password.trim(),
          role: raw.role as AssignableAdminUserRole,
          status: raw.isActive ? 'APPROVED' : 'SUSPENDED',
        });

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditor();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(
          err?.error?.message ?? 'فشل حفظ المستخدم',
        );
      },
    });
  }

  protected toggleActive(user: AdminUser): void {
    this.api.update(user.id, { isActive: !user.isActive }).subscribe({
      next: () => this.load(),
      error: (err) =>
        this.error.set(err?.error?.message ?? 'فشل تحديث الحالة'),
    });
  }

  protected remove(user: AdminUser): void {
    this.deleteTarget.set(user);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const user = this.deleteTarget();
    if (!user || this.deleting()) return;
    this.deleting.set(true);
    this.api.remove(user.id).subscribe({
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
