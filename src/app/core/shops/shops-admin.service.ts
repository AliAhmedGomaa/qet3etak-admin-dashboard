import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShopUser, UserStatus } from '../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class ShopsAdminService {
  private readonly http = inject(HttpClient);

  list(status?: UserStatus): Observable<ShopUser[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ShopUser[]>(`${environment.apiUrl}/admin/shops`, {
      params,
    });
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
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl}${path}`;
  }
}
