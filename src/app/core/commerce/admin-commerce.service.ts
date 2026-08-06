import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';

export type OrderStatus = 'RECEIVED' | 'SHIPPED' | 'DELIVERED' | 'RETURNED';

export interface AdminWallet {
  id: string;
  shopId:
    | string
    | {
        _id?: string;
        id?: string;
        shopName?: string;
        fullName?: string;
        phone?: string;
        status?: string;
        city?: string;
      };
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  utilization: number;
  transactions: Array<{
    id?: string;
    type: string;
    amount: number;
    balanceAfter: number;
    note: string;
    createdAt?: string;
  }>;
  transactionsMeta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  status: OrderStatus;
  paymentMethod: string;
  total: number;
  items: Array<{ title: string; quantity: number; lineTotal: number }>;
  deliveryGuyId?: string;
  deliveryGuyName?: string;
  deliveryFee?: number;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminCommerceService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  wallets(params: PageParams = {}): Observable<Paginated<AdminWallet>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<Paginated<AdminWallet>>(`${this.api}/admin/wallets`, {
      params: httpParams,
    });
  }

  wallet(
    shopId: string,
    params: PageParams = {},
  ): Observable<AdminWallet> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<AdminWallet>(`${this.api}/admin/wallets/${shopId}`, {
      params: httpParams,
    });
  }

  setCreditLimit(shopId: string, creditLimit: number, note?: string) {
    return this.http.patch<AdminWallet>(
      `${this.api}/admin/wallets/${shopId}/credit-limit`,
      { creditLimit, note },
    );
  }

  recordPayment(shopId: string, amount: number, note?: string) {
    return this.http.post<AdminWallet>(
      `${this.api}/admin/wallets/${shopId}/payments`,
      { amount, note },
    );
  }

  orders(params: PageParams = {}): Observable<Paginated<AdminOrder>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    return this.http.get<Paginated<AdminOrder>>(`${this.api}/admin/orders`, {
      params: httpParams,
    });
  }

  updateOrderStatus(
    id: string,
    status: OrderStatus,
    note?: string,
    deliveryGuyId?: string,
  ) {
    return this.http.patch<AdminOrder>(`${this.api}/admin/orders/${id}/status`, {
      status,
      note,
      deliveryGuyId,
    });
  }

  assignDelivery(id: string, deliveryGuyId: string, note?: string) {
    return this.http.patch<AdminOrder>(`${this.api}/admin/orders/${id}/delivery`, {
      deliveryGuyId,
      note,
    });
  }

  /** Full order return: restock + CREDIT refund + status RETURNED. */
  markReturned(id: string, reason?: string) {
    return this.http.patch<{
      order: AdminOrder;
      returnRequest: unknown;
    }>(`${this.api}/admin/orders/${id}/return`, {
      reason,
    });
  }
}
