import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReportRange {
  from: string;
  to: string;
}

export interface ReportSummary {
  range: ReportRange;
  orderCount: number;
  revenue: number;
  deliveredCount: number;
  deliveredRevenue: number;
  deliveryFees: number;
  assignedDeliveries: number;
  totalDebt: number;
  totalCreditLimit: number;
  shopsWithDebt: number;
  lowStockCount: number;
}

export interface SalesReport {
  range: ReportRange;
  totals: { orderCount: number; revenue: number; unitsSold: number };
  byStatus: Array<{ status: string; orderCount: number; revenue: number }>;
  byPaymentMethod: Array<{
    paymentMethod: string;
    orderCount: number;
    revenue: number;
  }>;
  byDay: Array<{ date: string; orderCount: number; revenue: number }>;
}

export interface ShopsReport {
  range: ReportRange;
  summary: { shopCount: number; orderCount: number; revenue: number };
  items: Array<{
    shopId: string;
    shopName: string;
    orderCount: number;
    revenue: number;
    unitsSold: number;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductsReport {
  range: ReportRange;
  items: Array<{
    productId: string;
    title: string;
    sku: string;
    quantitySold: number;
    revenue: number;
    orderCount: number;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreditReport {
  range: ReportRange;
  summary: {
    totalDebt: number;
    totalCreditLimit: number;
    shopsWithDebt: number;
    walletCount: number;
  };
  movements: Array<{ type: string; count: number; totalAmount: number }>;
  balances: Array<{
    shopId: string;
    shopName: string;
    creditLimit: number;
    currentDebt: number;
    availableCredit: number;
    utilization: number;
  }>;
}

export interface DeliveryReport {
  range: ReportRange;
  summary: {
    deliveries: number;
    deliveredCount: number;
    feesEarned: number;
  };
  byCourier: Array<{
    deliveryGuyId: string;
    deliveryGuyName: string;
    deliveries: number;
    deliveredCount: number;
    feesEarned: number;
    feesAssigned: number;
    orderRevenue: number;
  }>;
  lifetime: Array<{
    id: string;
    fullName: string;
    status: string;
    totalDeliveries: number;
    totalFeesEarned: number;
  }>;
}

export interface ReturnsReport {
  range: ReportRange;
  summary: {
    returnCount: number;
    refundAmount: number;
    unitsReturned: number;
  };
  byStatus: Array<{
    status: string;
    returnCount: number;
    refundAmount: number;
  }>;
  byRefundMethod: Array<{
    refundMethod: string;
    returnCount: number;
    refundAmount: number;
  }>;
  recent: Array<{
    id: string;
    shopName: string;
    orderNumber: string;
    status: string;
    refundAmount: number;
    refundMethod?: string;
    reason: string;
    createdAt: string;
  }>;
}

export interface InventoryReport {
  lowStockThreshold: number;
  summary: {
    productCount: number;
    totalUnits: number;
    inventoryValue: number;
    retailValue: number;
    outOfStock: number;
    lowStock: number;
  };
  items: Array<{
    productId: string;
    title: string;
    sku: string;
    brand: string;
    stockQuantity: number;
    costPrice: number;
    basePrice: number;
    stockValue: number;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ReportTab =
  | 'summary'
  | 'sales'
  | 'shops'
  | 'products'
  | 'credit'
  | 'delivery'
  | 'returns'
  | 'inventory';

export interface ReportQuery {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  lowStockThreshold?: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/reports`;

  summary(q: ReportQuery = {}): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(`${this.base}/summary`, {
      params: this.params(q),
    });
  }

  sales(q: ReportQuery = {}): Observable<SalesReport> {
    return this.http.get<SalesReport>(`${this.base}/sales`, {
      params: this.params(q),
    });
  }

  shops(q: ReportQuery = {}): Observable<ShopsReport> {
    return this.http.get<ShopsReport>(`${this.base}/shops`, {
      params: this.params({ ...q, limit: q.limit ?? 20 }),
    });
  }

  products(q: ReportQuery = {}): Observable<ProductsReport> {
    return this.http.get<ProductsReport>(`${this.base}/products`, {
      params: this.params({ ...q, limit: q.limit ?? 20 }),
    });
  }

  credit(q: ReportQuery = {}): Observable<CreditReport> {
    return this.http.get<CreditReport>(`${this.base}/credit`, {
      params: this.params(q),
    });
  }

  delivery(q: ReportQuery = {}): Observable<DeliveryReport> {
    return this.http.get<DeliveryReport>(`${this.base}/delivery`, {
      params: this.params(q),
    });
  }

  returns(q: ReportQuery = {}): Observable<ReturnsReport> {
    return this.http.get<ReturnsReport>(`${this.base}/returns`, {
      params: this.params(q),
    });
  }

  inventory(q: ReportQuery = {}): Observable<InventoryReport> {
    return this.http.get<InventoryReport>(`${this.base}/inventory`, {
      params: this.params({
        page: q.page,
        limit: q.limit ?? 50,
        lowStockThreshold: q.lowStockThreshold ?? 10,
      }),
    });
  }

  /** Download CSV for a report type (backend `format=csv`). */
  downloadCsv(tab: Exclude<ReportTab, 'summary'>, q: ReportQuery = {}): Observable<void> {
    const path = tab;
    let params =
      tab === 'inventory'
        ? new HttpParams()
            .set('format', 'csv')
            .set('lowStockThreshold', String(q.lowStockThreshold ?? 10))
            .set('page', String(q.page ?? 1))
            .set('limit', String(q.limit ?? 50))
        : this.params(q).set('format', 'csv');

    return this.http
      .get(`${this.base}/${path}`, {
        params,
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((res) => {
          const blob = res.body;
          if (!blob) return;
          const disposition = res.headers.get('Content-Disposition') ?? '';
          const match = /filename="?([^"]+)"?/.exec(disposition);
          const filename = match?.[1] ?? `${tab}-report.csv`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }),
      );
  }

  private params(q: ReportQuery): HttpParams {
    let p = new HttpParams();
    if (q.from) p = p.set('from', q.from);
    if (q.to) p = p.set('to', q.to);
    if (q.page) p = p.set('page', String(q.page));
    if (q.limit) p = p.set('limit', String(q.limit));
    if (q.lowStockThreshold != null) {
      p = p.set('lowStockThreshold', String(q.lowStockThreshold));
    }
    return p;
  }
}

export const STATUS_AR: Record<string, string> = {
  RECEIVED: 'مستلم',
  PREPARING: 'قيد التجهيز',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التسليم',
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

export const PAYMENT_AR: Record<string, string> = {
  CREDIT: 'ائتمان',
  CASH_ON_DELIVERY: 'دفع عند الاستلام',
};

export const WALLET_TX_AR: Record<string, string> = {
  CREDIT_PURCHASE: 'شراء بالائتمان',
  PAYMENT: 'سداد',
  ADJUSTMENT: 'تعديل',
  CREDIT_LIMIT_CHANGE: 'تغيير الحد',
};

export const REFUND_AR: Record<string, string> = {
  WALLET_CREDIT: 'رصيد محفظة',
  NONE: 'بدون محفظة',
};
