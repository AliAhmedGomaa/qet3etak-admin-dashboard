import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';

export type InvoiceStatus = 'ISSUED' | 'PAID' | 'VOID';
export type PaymentMethod = 'CREDIT' | 'CASH_ON_DELIVERY';

export interface InvoiceParty {
  name: string;
  phone: string;
  city: string;
  address: string;
  taxId: string;
}

export interface InvoiceLine {
  title: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  items: InvoiceLine[];
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  issuedAt: string;
  notes?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class InvoicesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/invoices`;

  list(
    params: PageParams & { status?: InvoiceStatus } = {},
  ): Observable<Paginated<AdminInvoice>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.q?.trim()) httpParams = httpParams.set('q', params.q.trim());
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<Paginated<AdminInvoice>>(this.base, {
      params: httpParams,
    });
  }

  get(id: string): Observable<AdminInvoice> {
    return this.http.get<AdminInvoice>(`${this.base}/${id}`);
  }

  void(id: string): Observable<AdminInvoice> {
    return this.http.patch<AdminInvoice>(`${this.base}/${id}/void`, {});
  }
}
