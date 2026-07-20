import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  list(status?: SpecialRequestStatus): Observable<AdminSpecialRequest[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<AdminSpecialRequest[]>(
      `${this.api}/admin/special-requests`,
      { params },
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
