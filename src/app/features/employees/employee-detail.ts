import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AttendanceDay,
  Employee,
  EmployeeStatus,
  HrAdminService,
  PayrollAdjustment,
  VacationRequest,
  VacationType,
  currentYearMonth,
} from '../../core/hr/hr-admin.service';

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'نشط',
  ON_LEAVE: 'في إجازة',
  TERMINATED: 'منتهي',
};

const VACATION_TYPE_LABELS: Record<VacationType, string> = {
  ANNUAL: 'سنوية',
  SICK: 'مرضية',
  UNPAID: 'بدون راتب',
};

@Component({
  selector: 'app-employee-detail',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './employee-detail.html',
  styleUrl: './employee-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(HrAdminService);

  protected readonly employee = signal<Employee | null>(null);
  protected readonly attendance = signal<AttendanceDay[]>([]);
  protected readonly vacations = signal<VacationRequest[]>([]);
  protected readonly adjustments = signal<PayrollAdjustment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly month = signal(currentYearMonth());
  protected readonly busy = signal(false);

  protected attDate = '';
  protected attHours = 8;
  protected attNote = '';

  protected vacFrom = '';
  protected vacTo = '';
  protected vacType: VacationType = 'ANNUAL';
  protected vacReason = '';

  protected adjType: 'BONUS' | 'DEDUCTION' = 'BONUS';
  protected adjAmount = 0;
  protected adjNote = '';

  protected payBonus = 0;
  protected payDeduction = 0;
  protected payNote = '';

  private employeeId = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const monthQ = this.route.snapshot.queryParamMap.get('month');
    if (!id) {
      this.loading.set(false);
      this.error.set('معرّف الموظف غير موجود');
      return;
    }
    this.employeeId = id;
    if (monthQ) this.month.set(monthQ);
    this.reload();
  }

  protected statusLabel(status: EmployeeStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected vacationTypeLabel(type: VacationType): string {
    return VACATION_TYPE_LABELS[type] ?? type;
  }

  protected vacationStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'قيد المراجعة',
      APPROVED: 'مقبولة',
      REJECTED: 'مرفوضة',
    };
    return map[status] ?? status;
  }

  protected onMonthChange(value: string): void {
    if (!value || value === this.month()) return;
    this.month.set(value);
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getEmployee(this.employeeId, this.month()).subscribe({
      next: (emp) => {
        this.employee.set(emp);
        this.attHours = emp.standardDailyHours || 8;
        this.loading.set(false);
        this.loadAttendance();
        this.loadVacations();
        this.loadAdjustments();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل بيانات الموظف');
      },
    });
  }

  protected saveAttendance(): void {
    if (!this.attDate) {
      this.error.set('اختر تاريخ الحضور');
      return;
    }
    this.busy.set(true);
    this.api
      .upsertAttendance(this.employeeId, {
        date: this.attDate,
        hours: Number(this.attHours),
        note: this.attNote.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.attNote = '';
          this.reload();
        },
        error: (err: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.error.set(err.error?.message || 'تعذر حفظ الحضور');
        },
      });
  }

  protected removeAttendance(day: AttendanceDay): void {
    const date = String(day.date).slice(0, 10);
    this.busy.set(true);
    this.api.removeAttendance(this.employeeId, date).subscribe({
      next: () => {
        this.busy.set(false);
        this.reload();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('تعذر حذف يوم الحضور');
      },
    });
  }

  protected createVacation(): void {
    if (!this.vacFrom || !this.vacTo) {
      this.error.set('حدد فترة الإجازة');
      return;
    }
    this.busy.set(true);
    this.api
      .createVacation({
        employeeId: this.employeeId,
        from: this.vacFrom,
        to: this.vacTo,
        type: this.vacType,
        reason: this.vacReason.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.vacReason = '';
          this.loadVacations();
          this.reload();
        },
        error: (err: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.error.set(err.error?.message || 'تعذر إنشاء طلب الإجازة');
        },
      });
  }

  protected reviewVacation(id: string, status: 'APPROVED' | 'REJECTED'): void {
    this.busy.set(true);
    this.api.reviewVacation(id, status).subscribe({
      next: () => {
        this.busy.set(false);
        this.loadVacations();
        this.reload();
      },
      error: (err: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'تعذر مراجعة الإجازة');
      },
    });
  }

  protected paySalary(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api
      .paySalary(this.employeeId, {
        month: this.month(),
        bonus: Number(this.payBonus) || 0,
        deduction: Number(this.payDeduction) || 0,
        note: this.payNote.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.payBonus = 0;
          this.payDeduction = 0;
          this.payNote = '';
          this.reload();
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          this.busy.set(false);
          const msg = err.error?.message;
          this.error.set(
            Array.isArray(msg)
              ? msg.join(' · ')
              : typeof msg === 'string'
                ? msg
                : 'تعذر صرف الراتب',
          );
        },
      });
  }

  protected unpaySalary(): void {
    this.busy.set(true);
    this.api.unpaySalary(this.employeeId, this.month()).subscribe({
      next: () => {
        this.busy.set(false);
        this.reload();
      },
      error: (err: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.error.set(err.error?.message || 'تعذر إلغاء الصرف');
      },
    });
  }

  protected addAdjustment(): void {
    if (!this.adjAmount || this.adjAmount <= 0) {
      this.error.set('أدخل مبلغ المكافأة أو الخصم');
      return;
    }
    this.busy.set(true);
    this.api
      .createAdjustment({
        employeeId: this.employeeId,
        month: this.month(),
        type: this.adjType,
        amount: Number(this.adjAmount),
        note: this.adjNote.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.adjAmount = 0;
          this.adjNote = '';
          this.reload();
        },
        error: (err: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.error.set(err.error?.message || 'تعذر إضافة التعديل');
        },
      });
  }

  protected removeAdjustment(id: string): void {
    this.busy.set(true);
    this.api.removeAdjustment(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.reload();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('تعذر حذف التعديل');
      },
    });
  }

  private loadAttendance(): void {
    this.api.listAttendance(this.employeeId, this.month()).subscribe({
      next: (res) => this.attendance.set(res.items),
      error: () => this.attendance.set([]),
    });
  }

  private loadVacations(): void {
    this.api
      .listVacations({ employeeId: this.employeeId, limit: 50 })
      .subscribe({
        next: (res) => this.vacations.set(res.items),
        error: () => this.vacations.set([]),
      });
  }

  private loadAdjustments(): void {
    this.api
      .listAdjustments({
        employeeId: this.employeeId,
        month: this.month(),
        limit: 50,
      })
      .subscribe({
        next: (res) => this.adjustments.set(res.items),
        error: () => this.adjustments.set([]),
      });
  }
}
