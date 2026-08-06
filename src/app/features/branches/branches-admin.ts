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
import {
  Branch,
  BranchStatus,
  GeofencePoint,
} from '../../core/branches/branch.models';
import { BranchesAdminService } from '../../core/branches/branches-admin.service';
import { AdminUsersService } from '../../core/users/admin-users.service';
import { AdminUser } from '../../core/users/user.models';
import { AdminPager } from '../../shared/admin-pager/admin-pager';
import { GeofenceMapPicker } from '../../shared/geofence-map-picker/geofence-map-picker';

@Component({
  selector: 'app-branches-admin',
  imports: [ReactiveFormsModule, AdminPager, GeofenceMapPicker],
  templateUrl: './branches-admin.html',
  styleUrl: './branches-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchesAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BranchesAdminService);
  private readonly usersApi = inject(AdminUsersService);

  protected readonly branches = signal<Branch[]>([]);
  protected readonly managers = signal<AdminUser[]>([]);
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
  protected readonly statusFilter = signal<BranchStatus | ''>('');
  protected readonly managerTarget = signal<Branch | null>(null);
  protected readonly managerUserId = signal<string>('');
  protected readonly assigning = signal(false);

  /** Dedicated geofence map popup (separate from branch edit form). */
  protected readonly locationTarget = signal<Branch | null>(null);
  protected readonly locationPolygon = signal<GeofencePoint[]>([]);
  protected readonly locationSaving = signal(false);
  protected readonly locationError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    code: ['', [Validators.required, Validators.minLength(2)]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(3)]],
    phone: [''],
    notes: [''],
    status: this.fb.nonNullable.control<BranchStatus>('ACTIVE'),
  });

  ngOnInit(): void {
    this.load();
    for (const role of ['STAFF', 'MANAGER', 'BRANCH_MANAGER'] as const) {
      this.usersApi.list({ limit: 100, role }).subscribe({
        next: (res) =>
          this.managers.update((cur) => {
            const map = new Map(cur.map((u) => [u.id, u]));
            for (const u of res.items) map.set(u.id, u);
            return [...map.values()];
          }),
        error: () => undefined,
      });
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
        status: this.statusFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.branches.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(
            err?.error?.message ?? 'تعذر تحميل الفروع (يتطلب صلاحية مدير النظام)',
          );
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

  protected setStatusFilter(value: BranchStatus | ''): void {
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

  protected managerOutsideList(branch: Branch): boolean {
    const id = branch.manager?.id;
    if (!id) return false;
    return !this.managers().some((u) => u.id === id);
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      code: '',
      city: '',
      address: '',
      phone: '',
      notes: '',
      status: 'ACTIVE',
    });
    this.editorOpen.set(true);
  }

  protected openEdit(branch: Branch): void {
    this.editingId.set(branch.id);
    this.form.reset({
      name: branch.name,
      code: branch.code,
      city: branch.city,
      address: branch.address,
      phone: branch.phone || '',
      notes: branch.notes || '',
      status: branch.status,
    });
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
  }

  protected hasGeofence(branch: Branch): boolean {
    return (
      (Array.isArray(branch.geofencePolygon) &&
        branch.geofencePolygon.length >= 3) ||
      (branch.geofenceLat != null &&
        branch.geofenceLng != null &&
        (branch.geofenceRadiusMeters ?? 0) > 0)
    );
  }

  protected openLocation(branch: Branch): void {
    this.locationError.set(null);
    this.locationTarget.set(branch);
    this.locationPolygon.set(
      Array.isArray(branch.geofencePolygon) && branch.geofencePolygon.length >= 3
        ? branch.geofencePolygon.map((p) => ({ lat: p.lat, lng: p.lng }))
        : [],
    );
  }

  protected closeLocation(): void {
    if (this.locationSaving()) return;
    this.locationTarget.set(null);
    this.locationPolygon.set([]);
    this.locationError.set(null);
  }

  protected onLocationPolygonChange(points: GeofencePoint[]): void {
    this.locationPolygon.set(points);
    this.locationError.set(null);
  }

  protected onLocationCleared(): void {
    this.locationPolygon.set([]);
    this.locationError.set(null);
  }

  protected saveLocation(): void {
    const branch = this.locationTarget();
    if (!branch || this.locationSaving()) return;
    const poly = this.locationPolygon();
    if (poly.length > 0 && poly.length < 3) {
      this.locationError.set('أكمل رسم النطاق (3 نقاط على الأقل) أو امسحه');
      return;
    }
    this.locationSaving.set(true);
    this.locationError.set(null);
    this.api
      .update(branch.id, {
        geofencePolygon: poly.length >= 3 ? poly : [],
      })
      .subscribe({
        next: () => {
          this.locationSaving.set(false);
          this.closeLocation();
          this.load();
        },
        error: (err) => {
          this.locationSaving.set(false);
          this.locationError.set(
            err?.error?.message ?? 'فشل حفظ نطاق الموقع',
          );
        },
      });
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    const id = this.editingId();
    const payload = {
      name: raw.name.trim(),
      code: raw.code.trim(),
      city: raw.city.trim(),
      address: raw.address.trim(),
      phone: raw.phone.trim() || undefined,
      notes: raw.notes.trim() || undefined,
      status: raw.status,
    };
    const req$ = id
      ? this.api.update(id, payload)
      : this.api.create(payload);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditor();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'فشل حفظ الفرع');
      },
    });
  }

  protected openManager(branch: Branch): void {
    this.managerTarget.set(branch);
    this.managerUserId.set(branch.managerUserId || branch.manager?.id || '');
  }

  protected closeManager(): void {
    if (this.assigning()) return;
    this.managerTarget.set(null);
    this.managerUserId.set('');
  }

  protected confirmManager(): void {
    const branch = this.managerTarget();
    if (!branch || this.assigning()) return;
    this.assigning.set(true);
    const userId = this.managerUserId().trim() || null;
    this.api.assignManager(branch.id, userId).subscribe({
      next: () => {
        this.assigning.set(false);
        this.closeManager();
        this.load();
      },
      error: (err) => {
        this.assigning.set(false);
        this.error.set(err?.error?.message ?? 'فشل تعيين مدير الفرع');
      },
    });
  }

  protected toggleStatus(branch: Branch): void {
    const next: BranchStatus =
      branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.api.update(branch.id, { status: next }).subscribe({
      next: () => this.load(),
      error: (err) =>
        this.error.set(err?.error?.message ?? 'فشل تحديث حالة الفرع'),
    });
  }
}
