import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type OrderStatus = 'RECEIVED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED';

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
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminCommerceService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  wallets(): Observable<AdminWallet[]> {
    return this.http.get<AdminWallet[]>(`${this.api}/admin/wallets`);
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

  orders(): Observable<AdminOrder[]> {
    return this.http.get<AdminOrder[]>(`${this.api}/admin/orders`);
  }

  updateOrderStatus(id: string, status: OrderStatus, note?: string) {
    return this.http.patch<AdminOrder>(`${this.api}/admin/orders/${id}/status`, {
      status,
      note,
    });
  }
}
