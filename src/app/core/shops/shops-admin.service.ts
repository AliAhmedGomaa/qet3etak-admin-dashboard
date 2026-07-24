import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShopUser, UserStatus } from '../auth/auth.models';
import { PageParams, Paginated } from '../pagination';

@Injectable({ providedIn: 'root' })
export class ShopsAdminService {
  private readonly http = inject(HttpClient);

  list(
    status?: UserStatus,
    params: PageParams = {},
  ): Observable<Paginated<ShopUser>> {
    let httpParams = new HttpParams();
    if (status) httpParams = httpParams.set('status', status);
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<Paginated<ShopUser>>(
      `${environment.apiUrl}/admin/shops`,
      { params: httpParams },
    );
  }

  updateStatus(
    id: string,
    status: UserStatus,
    reason?: string,
  ): Observable<ShopUser> {
    return this.http.patch<ShopUser>(
      `${environment.apiUrl}/admin/shops/${id}/status`,
      { status, reason },
    );
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
