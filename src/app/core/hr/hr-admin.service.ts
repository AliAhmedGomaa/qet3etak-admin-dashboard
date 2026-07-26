import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';

export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
export type VacationType = 'ANNUAL' | 'SICK' | 'UNPAID';
export type VacationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SalaryPayment {
  id: string;
  employeeId: string;
  month: string;
  hoursWorked: number;
  hourlyRate: number;
  baseAmount: number;
  bonus: number;
  deduction: number;
  amount: number;
  paid: boolean;
  paidAt?: string;
  expenseId?: string;
  note?: string;
}

export interface Employee {
  id: string;
  fullName: string;
  phone: string;
  jobTitle: string;
  hourlyRate: number;
  standardDailyHours: number;
  annualLeaveDays: number;
  status: EmployeeStatus;
  hireDate: string;
  notes: string;
  month?: string;
  hoursWorkedThisMonth?: number;
  expectedPay?: number;
  baseAmount?: number;
  bonus?: number;
  deduction?: number;
  salaryPaidThisMonth?: boolean;
  payment?: SalaryPayment | null;
  vacationDaysUsedThisYear?: number;
  vacationDaysRemaining?: number;
  createdAt?: string;
}

export type EmployeeInput = {
  fullName: string;
  phone: string;
  jobTitle?: string;
  hourlyRate: number;
  standardDailyHours?: number;
  annualLeaveDays?: number;
  status?: EmployeeStatus;
  hireDate?: string;
  notes?: string;
  password?: string;
};

export interface AttendanceDay {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  note: string;
}

export interface AttendanceMonth {
  month: string;
  hoursWorked: number;
  items: AttendanceDay[];
}

export interface VacationRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  from: string;
  to: string;
  days: number;
  type: VacationType;
  status: VacationStatus;
  reason: string;
  reviewNote?: string;
  createdAt?: string;
}

export interface PayrollAdjustment {
  id: string;
  employeeId: string;
  employeeName?: string;
  month: string;
  type: 'BONUS' | 'DEDUCTION';
  amount: number;
  note: string;
  createdAt?: string;
}

export interface PaySalaryPayload {
  month: string;
  bonus?: number;
  deduction?: number;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class HrAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/hr`;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Live PENDING vacation count for the sidebar badge. */
  readonly pendingVacationCount = signal(0);

  listEmployees(
    params: PageParams & { status?: EmployeeStatus; month?: string } = {},
  ): Observable<Paginated<Employee>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.q?.trim()) httpParams = httpParams.set('q', params.q.trim());
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.month) httpParams = httpParams.set('month', params.month);
    return this.http.get<Paginated<Employee>>(`${this.base}/employees`, {
      params: httpParams,
    });
  }

  getEmployee(id: string, month?: string): Observable<Employee> {
    let httpParams = new HttpParams();
    if (month) httpParams = httpParams.set('month', month);
    return this.http.get<Employee>(`${this.base}/employees/${id}`, {
      params: httpParams,
    });
  }

  createEmployee(data: EmployeeInput): Observable<Employee> {
    return this.http.post<Employee>(`${this.base}/employees`, data);
  }

  updateEmployee(
    id: string,
    data: Partial<EmployeeInput>,
  ): Observable<Employee> {
    return this.http.patch<Employee>(`${this.base}/employees/${id}`, data);
  }

  terminateEmployee(id: string): Observable<Employee> {
    return this.http.delete<Employee>(`${this.base}/employees/${id}`);
  }

  listAttendance(id: string, month?: string): Observable<AttendanceMonth> {
    let httpParams = new HttpParams();
    if (month) httpParams = httpParams.set('month', month);
    return this.http.get<AttendanceMonth>(
      `${this.base}/employees/${id}/attendance`,
      { params: httpParams },
    );
  }

  upsertAttendance(
    id: string,
    data: { date: string; hours: number; note?: string },
  ): Observable<AttendanceDay> {
    return this.http.post<AttendanceDay>(
      `${this.base}/employees/${id}/attendance`,
      data,
    );
  }

  removeAttendance(id: string, date: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/employees/${id}/attendance/${date}`,
    );
  }

  listVacations(
    params: PageParams & {
      employeeId?: string;
      status?: VacationStatus;
    } = {},
  ): Observable<Paginated<VacationRequest>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.employeeId) {
      httpParams = httpParams.set('employeeId', params.employeeId);
    }
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<Paginated<VacationRequest>>(`${this.base}/vacations`, {
      params: httpParams,
    });
  }

  createVacation(data: {
    employeeId: string;
    from: string;
    to: string;
    type?: VacationType;
    reason?: string;
  }): Observable<VacationRequest> {
    return this.http
      .post<VacationRequest>(`${this.base}/vacations`, data)
      .pipe(tap(() => this.refreshPendingVacationCount()));
  }

  reviewVacation(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNote?: string,
  ): Observable<VacationRequest> {
    return this.http
      .patch<VacationRequest>(`${this.base}/vacations/${id}/review`, {
        status,
        reviewNote,
      })
      .pipe(tap(() => this.refreshPendingVacationCount()));
  }

  /** Start (or keep) polling PENDING vacation count — call once from admin shell. */
  startWatchingVacations(): void {
    this.refreshPendingVacationCount();
    if (this.pollTimer) return;
    this.pollTimer = setInterval(
      () => this.refreshPendingVacationCount(),
      30_000,
    );
  }

  refreshPendingVacationCount(): void {
    this.http
      .get<{ count: number }>(`${this.base}/vacations/pending-count`)
      .subscribe({
        next: (res) => this.pendingVacationCount.set(res.count ?? 0),
        error: () => {
          /* keep last known count */
        },
      });
  }

  listAdjustments(
    params: PageParams & {
      employeeId?: string;
      month?: string;
      type?: 'BONUS' | 'DEDUCTION';
    } = {},
  ): Observable<Paginated<PayrollAdjustment>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.employeeId) {
      httpParams = httpParams.set('employeeId', params.employeeId);
    }
    if (params.month) httpParams = httpParams.set('month', params.month);
    if (params.type) httpParams = httpParams.set('type', params.type);
    return this.http.get<Paginated<PayrollAdjustment>>(
      `${this.base}/adjustments`,
      { params: httpParams },
    );
  }

  createAdjustment(data: {
    employeeId: string;
    month: string;
    type: 'BONUS' | 'DEDUCTION';
    amount: number;
    note?: string;
  }): Observable<PayrollAdjustment> {
    return this.http.post<PayrollAdjustment>(`${this.base}/adjustments`, data);
  }

  removeAdjustment(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/adjustments/${id}`);
  }

  paySalary(id: string, payload: PaySalaryPayload): Observable<unknown> {
    return this.http.post(`${this.base}/employees/${id}/pay`, payload);
  }

  unpaySalary(id: string, month: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/employees/${id}/pay/${month}`,
    );
  }
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
