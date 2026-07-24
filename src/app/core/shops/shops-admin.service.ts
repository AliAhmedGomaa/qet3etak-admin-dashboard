import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShopUser, UserStatus } from '../auth/auth.models';
import { PageParams, Paginated } from '../pagination';

export type ShopInput = {
  fullName: string;
  shopName: string;
  phone: string;
  city: string;
  address: string;
  password?: string;
  commercialRegPhotoUrl?: string;
  status?: UserStatus;
  rejectionReason?: string;
};

@Injectable({ providedIn: 'root' })
export class ShopsAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/shops`;

  list(
    params: PageParams & { status?: UserStatus } = {},
  ): Observable<Paginated<ShopUser>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.q) httpParams = httpParams.set('q', params.q);
    return this.http.get<Paginated<ShopUser>>(this.base, { params: httpParams });
  }

  /** @deprecated Prefer list({ status, page, limit }) — kept for shop-approvals */
  listByStatus(
    status?: UserStatus,
    params: PageParams = {},
  ): Observable<Paginated<ShopUser>> {
    return this.list({ ...params, status });
  }

  get(id: string): Observable<ShopUser> {
    return this.http.get<ShopUser>(`${this.base}/${id}`);
  }

  create(data: ShopInput): Observable<ShopUser> {
    return this.http.post<ShopUser>(this.base, data);
  }

  update(id: string, data: Partial<ShopInput>): Observable<ShopUser> {
    return this.http.patch<ShopUser>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  updateStatus(
    id: string,
    status: UserStatus,
    reason?: string,
  ): Observable<ShopUser> {
    return this.http.patch<ShopUser>(`${this.base}/${id}/status`, {
      status,
      reason,
    });
  }

  photoUrl(path: string): string {
    if (!path) return '';
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('data:') ||
      path.startsWith('blob:')
    ) {
      return path;
    }
    if (path.startsWith('/')) return `${environment.apiUrl}${path}`;
    return `${environment.apiUrl}/${path}`;
  }
}
