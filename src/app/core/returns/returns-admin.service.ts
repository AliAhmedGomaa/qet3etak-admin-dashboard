import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';

export type ReturnRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ReturnRefundMethod = 'WALLET_CREDIT' | 'NONE';

export interface AdminReturnItem {
  productId: string;
  title: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminReturnRequest {
  id: string;
  shopId: string;
  shopName: string;
  orderId: string;
  orderNumber: string;
  paymentMethod: 'CREDIT' | 'CASH_ON_DELIVERY';
  items: AdminReturnItem[];
  refundAmount: number;
  reason: string;
  status: ReturnRequestStatus;
  adminNote?: string;
  refundMethod?: ReturnRefundMethod;
  reviewedAt?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ReturnsAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  list(
    status?: ReturnRequestStatus,
    params: PageParams = {},
  ): Observable<Paginated<AdminReturnRequest>> {
    let httpParams = new HttpParams();
    if (status) httpParams = httpParams.set('status', status);
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    return this.http.get<Paginated<AdminReturnRequest>>(
      `${this.api}/admin/returns`,
      { params: httpParams },
    );
  }

  get(id: string): Observable<AdminReturnRequest> {
    return this.http.get<AdminReturnRequest>(`${this.api}/admin/returns/${id}`);
  }

  approve(id: string, adminNote?: string): Observable<AdminReturnRequest> {
    return this.http.patch<AdminReturnRequest>(
      `${this.api}/admin/returns/${id}/approve`,
      { adminNote },
    );
  }

  reject(id: string, reason: string): Observable<AdminReturnRequest> {
    return this.http.patch<AdminReturnRequest>(
      `${this.api}/admin/returns/${id}/reject`,
      { reason },
    );
  }
}
