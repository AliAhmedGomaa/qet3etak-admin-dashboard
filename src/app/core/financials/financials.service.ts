import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';

export type ExpenseCategory =
  | 'RENT'
  | 'SALARIES'
  | 'SHIPPING'
  | 'DAMAGED_PARTS'
  | 'UTILITIES';

export interface PnlReport {
  range: { startDate: string; endDate: string };
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  grossMargin: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  orderCount: number;
  unitsSold: number;
  expensesByCategory: Array<{ category: ExpenseCategory; amount: number }>;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  createdAt?: string;
}

export interface CreateExpensePayload {
  category: ExpenseCategory;
  amount: number;
  date?: string;
  description?: string;
}

export interface DamagedStockPayload {
  productId: string;
  quantity: number;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class FinancialsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/financials`;

  pnl(startDate?: string, endDate?: string): Observable<PnlReport> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<PnlReport>(`${this.base}/pnl`, { params });
  }

  expenses(params: PageParams = {}): Observable<Paginated<Expense>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<Paginated<Expense>>(`${this.base}/expenses`, {
      params: httpParams,
    });
  }

  createExpense(payload: CreateExpensePayload): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/expenses`, payload);
  }

  removeExpense(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/expenses/${id}`,
    );
  }

  recordDamagedStock(payload: DamagedStockPayload): Observable<unknown> {
    return this.http.post(`${this.base}/damaged-stock`, payload);
  }
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'RENT',
  'SALARIES',
  'SHIPPING',
  'DAMAGED_PARTS',
  'UTILITIES',
];

export const EXPENSE_CATEGORY_AR: Record<ExpenseCategory, string> = {
  RENT: 'إيجار',
  SALARIES: 'رواتب',
  SHIPPING: 'شحن',
  DAMAGED_PARTS: 'تالف / هالك',
  UTILITIES: 'مرافق',
};
