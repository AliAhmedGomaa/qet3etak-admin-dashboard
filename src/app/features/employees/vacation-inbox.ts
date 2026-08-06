import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  HrAdminService,
  VacationRequest,
} from '../../core/hr/hr-admin.service';

@Component({
  selector: 'app-vacation-inbox',
  imports: [DatePipe, RouterLink],
  template: `
    <section class="inbox" dir="rtl">
      <header>
        <div>
          <h1>طلبات الإجازات</h1>
          <p>طلبات الموظفين من بوابة الموظف ولوحة الإدارة — قيد المراجعة.</p>
        </div>
        <div class="actions">
          <a routerLink="/employees" class="btn">الموظفون</a>
        </div>
      </header>
      @if (error()) {
        <p class="err">{{ error() }}</p>
      }
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الموظف</th>
              <th>الفترة</th>
              <th>الأيام</th>
              <th>النوع</th>
              <th>السبب</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="6" class="muted">جارٍ التحميل…</td></tr>
            } @else {
              @for (v of items(); track v.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/employees', v.employeeId]">{{ v.employeeName || 'موظف' }}</a>
                  </td>
                  <td>{{ v.from | date: 'mediumDate' }} → {{ v.to | date: 'mediumDate' }}</td>
                  <td>{{ v.days }}</td>
                  <td>{{ typeLabel(v.type) }}</td>
                  <td>{{ v.reason || '—' }}</td>
                  <td class="row-actions">
                    <button type="button" class="btn primary" (click)="review(v.id, 'APPROVED')">قبول</button>
                    <button type="button" class="btn" (click)="review(v.id, 'REJECTED')">رفض</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="muted">لا توجد طلبات قيد المراجعة.</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [
    `
      .inbox {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      }
      h1 {
        margin: 0;
        font-size: 1.4rem;
      }
      p {
        margin: 0.3rem 0 0;
        color: #64748b;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
      }
      .table-wrap {
        overflow: auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      th,
      td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        text-align: start;
      }
      th {
        background: #f8fafc;
        color: #64748b;
        font-size: 0.7rem;
      }
      .btn {
        min-height: 2.4rem;
        padding: 0 0.85rem;
        border-radius: 0.65rem;
        border: 1.5px solid #e2e8f0;
        background: #fff;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        color: inherit;
        display: inline-flex;
        align-items: center;
      }
      .btn.primary {
        background: #10b880;
        border-color: #10b880;
        color: #fff;
      }
      .row-actions {
        display: flex;
        gap: 0.35rem;
      }
      .err {
        background: #fef2f2;
        color: #991b1b;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
      }
      .muted {
        text-align: center;
        color: #94a3b8;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VacationInbox implements OnInit {
  private readonly api = inject(HrAdminService);
  protected readonly items = signal<VacationRequest[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected typeLabel(type: string): string {
    const map: Record<string, string> = {
      ANNUAL: 'سنوية',
      SICK: 'مرضية',
      UNPAID: 'بدون راتب',
    };
    return map[type] ?? type;
  }

  protected load(): void {
    this.loading.set(true);
    this.api.listVacations({ status: 'PENDING', limit: 100 }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل طلبات الإجازات');
      },
    });
  }

  protected review(id: string, status: 'APPROVED' | 'REJECTED'): void {
    this.api.reviewVacation(id, status).subscribe({
      next: () => this.load(),
      error: () => this.error.set('تعذر مراجعة الطلب'),
    });
  }
}
