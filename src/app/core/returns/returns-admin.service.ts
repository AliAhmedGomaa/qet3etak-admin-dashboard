import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
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

/** Poll interval for the PENDING returns nav badge (returns have no socket). */
const PENDING_POLL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class ReturnsAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Live PENDING count for the sidebar badge (mirrors chat.totalUnread). */
  readonly pendingCount = signal(0);

  list(
    status?: ReturnRequestStatus,
    params: PageParams = {},
  ): Observable<Paginated<AdminReturnRequest>> {
    let httpParams = new HttpParams();
    if (status) httpParams = httpParams.set('status', status);
    if (params.page != null)
      httpParams = httpParams.set('page', String(params.page));
    if (params.limit != null)
      httpParams = httpParams.set('limit', String(params.limit));
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
    return this.http
      .patch<AdminReturnRequest>(`${this.api}/admin/returns/${id}/approve`, {
        adminNote,
      })
      .pipe(tap(() => this.refreshPendingCount()));
  }

  reject(id: string, reason: string): Observable<AdminReturnRequest> {
    return this.http
      .patch<AdminReturnRequest>(`${this.api}/admin/returns/${id}/reject`, {
        reason,
      })
      .pipe(tap(() => this.refreshPendingCount()));
  }

  /** Start (or keep) polling PENDING count — call once from the admin shell. */
  startWatching(): void {
    this.refreshPendingCount();
    if (this.pollTimer) return;
    this.pollTimer = setInterval(
      () => this.refreshPendingCount(),
      PENDING_POLL_MS,
    );
  }

  refreshPendingCount(): void {
    this.http
      .get<{ count: number }>(`${this.api}/admin/returns/pending-count`)
      .subscribe({
        next: (res) => this.pendingCount.set(res.count ?? 0),
        error: () => {
          /* keep last known count */
        },
      });
  }
}
