import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';
import {
  AdminRole,
  CreateAdminRolePayload,
  UpdateAdminRolePayload,
} from './role.models';

export type AdminRolesListParams = PageParams & {
  includeInactive?: boolean;
  adminPanelOnly?: boolean;
};

@Injectable({ providedIn: 'root' })
export class RolesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/roles`;

  list(params: AdminRolesListParams = {}): Observable<Paginated<AdminRole>> {
    let httpParams = new HttpParams();
    if (params.page != null)
      httpParams = httpParams.set('page', String(params.page));
    if (params.limit != null)
      httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    if (params.includeInactive) httpParams = httpParams.set('includeInactive', '1');
    if (params.adminPanelOnly) httpParams = httpParams.set('adminPanelOnly', '1');
    return this.http.get<Paginated<AdminRole>>(this.base, { params: httpParams });
  }

  get(id: string): Observable<AdminRole> {
    return this.http.get<AdminRole>(`${this.base}/${id}`);
  }

  create(data: CreateAdminRolePayload): Observable<AdminRole> {
    return this.http.post<AdminRole>(this.base, data);
  }

  update(id: string, data: UpdateAdminRolePayload): Observable<AdminRole> {
    return this.http.patch<AdminRole>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
