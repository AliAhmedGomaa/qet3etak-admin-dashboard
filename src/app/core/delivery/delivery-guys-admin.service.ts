import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';

export type DeliveryGuyStatus = 'ACTIVE' | 'INACTIVE';
export type DeliveryFeeModel = 'FLAT' | 'PERCENT' | 'BASE_PLUS_ITEMS';

export interface DeliveryGuy {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  vehicleType: string;
  notes: string;
  status: DeliveryGuyStatus;
  feeModel: DeliveryFeeModel;
  flatFee: number;
  percentRate: number;
  baseFee: number;
  perItemFee: number;
  totalDeliveries: number;
  totalFeesEarned: number;
  createdAt?: string;
  updatedAt?: string;
}

export type DeliveryGuyInput = {
  fullName: string;
  phone: string;
  password?: string;
  city?: string;
  vehicleType?: string;
  notes?: string;
  status?: DeliveryGuyStatus;
  feeModel?: DeliveryFeeModel;
  flatFee?: number;
  percentRate?: number;
  baseFee?: number;
  perItemFee?: number;
};

@Injectable({ providedIn: 'root' })
export class DeliveryGuysAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/delivery-guys`;

  list(
    params: PageParams & {
      status?: DeliveryGuyStatus | 'ALL';
      includeInactive?: boolean;
    } = {},
  ): Observable<Paginated<DeliveryGuy>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.q?.trim()) httpParams = httpParams.set('q', params.q.trim());
    if (params.includeInactive) {
      httpParams = httpParams.set('includeInactive', '1');
    } else if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    return this.http.get<Paginated<DeliveryGuy>>(this.base, {
      params: httpParams,
    });
  }

  create(data: DeliveryGuyInput): Observable<DeliveryGuy> {
    return this.http.post<DeliveryGuy>(this.base, data);
  }

  update(id: string, data: Partial<DeliveryGuyInput>): Observable<DeliveryGuy> {
    return this.http.patch<DeliveryGuy>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  calculateFee(
    id: string,
    orderTotal: number,
    itemCount: number,
  ): Observable<{ fee: number; feeModel: DeliveryFeeModel; guyId: string }> {
    return this.http.post<{
      fee: number;
      feeModel: DeliveryFeeModel;
      guyId: string;
    }>(`${this.base}/${id}/calculate-fee`, { orderTotal, itemCount });
  }
}
