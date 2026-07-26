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
import { RouterLink } from '@angular/router';
import {
  Employee,
  EmployeeStatus,
  HrAdminService,
  currentYearMonth,
} from '../../core/hr/hr-admin.service';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'نشط',
  ON_LEAVE: 'في إجازة',
  TERMINATED: 'منتهي',
};

@Component({
  selector: 'app-employees-admin',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    RouterLink,
    ConfirmDialog,
    AdminPager,
  ],
  templateUrl: './employees-admin.html',
  styleUrl: './employees-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(HrAdminService);

  protected readonly employees = signal<Employee[]>([]);
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
  protected readonly statusFilter = signal<EmployeeStatus | ''>('');
  protected readonly month = signal(currentYearMonth());
  protected readonly terminateTarget = signal<Employee | null>(null);
  protected readonly terminating = signal(false);

  protected readonly statusOptions: Array<{
    value: EmployeeStatus | '';
    label: string;
  }> = [
    { value: '', label: 'الكل' },
    { value: 'ACTIVE', label: STATUS_LABELS.ACTIVE },
    { value: 'ON_LEAVE', label: STATUS_LABELS.ON_LEAVE },
    { value: 'TERMINATED', label: STATUS_LABELS.TERMINATED },
  ];

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    jobTitle: [''],
    hourlyRate: [50, [Validators.required, Validators.min(0)]],
    standardDailyHours: [8, [Validators.min(0)]],
    annualLeaveDays: [21, [Validators.min(0)]],
    status: this.fb.nonNullable.control<EmployeeStatus>('ACTIVE'),
    hireDate: [''],
    notes: [''],
    password: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  protected statusLabel(status: EmployeeStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listEmployees({
        page: this.page(),
        limit: 20,
        q: this.searchQuery() || undefined,
        status: this.statusFilter() || undefined,
        month: this.month(),
      })
      .subscribe({
        next: (res) => {
          this.employees.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل الموظفين');
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

  protected setStatusFilter(value: EmployeeStatus | ''): void {
    if (value === this.statusFilter()) return;
    this.statusFilter.set(value);
    this.page.set(1);
    this.load();
  }

  protected onMonthChange(value: string): void {
    if (!value || value === this.month()) return;
    this.month.set(value);
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
      jobTitle: '',
      hourlyRate: 50,
      standardDailyHours: 8,
      annualLeaveDays: 21,
      status: 'ACTIVE',
      hireDate: '',
      notes: '',
      password: '',
    });
    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(6),
    ]);
    this.form.controls.password.updateValueAndValidity();
    this.editorOpen.set(true);
  }

  protected openEdit(emp: Employee): void {
    this.editingId.set(emp.id);
    this.form.reset({
      fullName: emp.fullName,
      phone: emp.phone,
      jobTitle: emp.jobTitle || '',
      hourlyRate: emp.hourlyRate,
      standardDailyHours: emp.standardDailyHours,
      annualLeaveDays: emp.annualLeaveDays,
      status: emp.status,
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      notes: emp.notes || '',
      password: '',
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

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    const payload = {
      fullName: value.fullName.trim(),
      phone: value.phone.trim(),
      jobTitle: value.jobTitle.trim() || undefined,
      hourlyRate: Number(value.hourlyRate),
      standardDailyHours: Number(value.standardDailyHours),
      annualLeaveDays: Number(value.annualLeaveDays),
      status: value.status,
      hireDate: value.hireDate || undefined,
      notes: value.notes.trim() || undefined,
      ...(value.password.trim() ? { password: value.password.trim() } : {}),
    };
    const req = this.editingId()
      ? this.api.updateEmployee(this.editingId()!, payload)
      : this.api.createEmployee({
          ...payload,
          password: value.password.trim(),
        });
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
              : 'تعذر حفظ الموظف',
        );
      },
    });
  }

  protected askTerminate(emp: Employee): void {
    this.terminateTarget.set(emp);
  }

  protected confirmTerminate(): void {
    const emp = this.terminateTarget();
    if (!emp) return;
    this.terminating.set(true);
    this.api.terminateEmployee(emp.id).subscribe({
      next: () => {
        this.terminating.set(false);
        this.terminateTarget.set(null);
        this.load();
      },
      error: () => {
        this.terminating.set(false);
        this.error.set('تعذر إنهاء خدمة الموظف');
        this.terminateTarget.set(null);
      },
    });
  }

  protected cancelTerminate(): void {
    this.terminateTarget.set(null);
  }
}
