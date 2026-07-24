import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';
import { AdminRole } from '../roles/role.models';
import { RolesAdminService } from '../roles/roles-admin.service';
import {
  AdminRoleDefinition,
  AdminUser,
  AdminUserRole,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
} from './user.models';

export type AdminUsersListParams = PageParams & {
  role?: AdminUserRole;
  roleId?: string;
  status?: string;
};

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly rolesApi = inject(RolesAdminService);
  private readonly base = `${environment.apiUrl}/admin/users`;

  list(params: AdminUsersListParams = {}): Observable<Paginated<AdminUser>> {
    let httpParams = new HttpParams();
    if (params.page != null)
      httpParams = httpParams.set('page', String(params.page));
    if (params.limit != null)
      httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    if (params.role) httpParams = httpParams.set('role', params.role);
    if (params.roleId) httpParams = httpParams.set('roleId', params.roleId);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<Paginated<AdminUser>>(this.base, {
      params: httpParams,
    });
  }

  /** Panel roles for staff assignment dropdowns (back-compat shape). */
  listRoles(): Observable<{ items: AdminRoleDefinition[] }> {
    return this.rolesApi
      .list({ limit: 100, includeInactive: false, adminPanelOnly: true })
      .pipe(
        map((res) => ({
          items: res.items.map((r) => this.toDefinition(r)),
        })),
      );
  }

  get(id: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.base}/${id}`);
  }

  create(data: CreateAdminUserPayload): Observable<AdminUser> {
    return this.http.post<AdminUser>(this.base, data);
  }

  update(id: string, data: UpdateAdminUserPayload): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }

  private toDefinition(r: AdminRole): AdminRoleDefinition {
    return {
      id: r.id,
      role: r.code,
      code: r.code,
      name: r.name,
      labelAr: r.name,
      labelEn: r.code,
      descriptionAr: r.description ?? '',
      canAccessAdmin: r.adminPanel,
      adminPanel: r.adminPanel,
      isSystem: r.isSystem,
    };
  }
}
