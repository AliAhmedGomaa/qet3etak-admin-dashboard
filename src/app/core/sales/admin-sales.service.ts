import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SoldTodayLine = {
  orderId: string;
  orderNumber: string;
  source: string;
  shopName: string;
  customerName: string;
  productId: string;
  title: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  paymentMethod: string;
  createdAt: string;
};

export type SoldTodayResponse = {
  date: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  lines: SoldTodayLine[];
};

export type WalkInSaleItem = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type WalkInSaleInput = {
  items: WalkInSaleItem[];
  customerName?: string;
  customerPhone?: string;
  notes?: string;
};

@Injectable({ providedIn: 'root' })
export class AdminSalesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/sales`;

  soldToday(): Observable<SoldTodayResponse> {
    return this.http.get<SoldTodayResponse>(`${this.base}/today`);
  }

  walkIn(data: WalkInSaleInput): Observable<unknown> {
    return this.http.post(`${this.base}/walk-in`, data);
  }
}
