import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';

export type SpecialRequestStatus = 'PENDING' | 'QUOTED' | 'FULFILLED';

export interface AdminSpecialRequest {
  id: string;
  shopId: string;
  shopName: string;
  deviceModel: string;
  partName: string;
  quantity: number;
  targetPrice: number;
  photoUrl: string;
  status: SpecialRequestStatus;
  quotePrice?: number;
  estimatedArrival?: string;
  adminReply?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminSpecialRequestsApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  list(
    status?: SpecialRequestStatus,
    params: PageParams = {},
  ): Observable<Paginated<AdminSpecialRequest>> {
    let httpParams = new HttpParams();
    if (status) httpParams = httpParams.set('status', status);
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    return this.http.get<Paginated<AdminSpecialRequest>>(
      `${this.api}/admin/special-requests`,
      { params: httpParams },
    );
  }

  quote(
    id: string,
    body: { quotePrice: number; estimatedArrival?: string; adminReply?: string },
  ) {
    return this.http.patch<AdminSpecialRequest>(
      `${this.api}/admin/special-requests/${id}/quote`,
      body,
    );
  }

  fulfill(id: string) {
    return this.http.patch<AdminSpecialRequest>(
      `${this.api}/admin/special-requests/${id}/fulfill`,
      {},
    );
  }

  broadcast(body: { title: string; body: string; url?: string }) {
    return this.http.post<{ sent: number }>(
      `${this.api}/admin/push/broadcast`,
      body,
    );
  }

  photoUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${this.api}${path}`;
  }
}
