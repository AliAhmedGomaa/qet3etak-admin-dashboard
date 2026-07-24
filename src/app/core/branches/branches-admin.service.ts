import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageParams, Paginated } from '../pagination';
import {
  Branch,
  BranchOption,
  BranchStatus,
  CreateBranchPayload,
  UpdateBranchPayload,
} from './branch.models';

@Injectable({ providedIn: 'root' })
export class BranchesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/branches`;

  list(
    params: PageParams & { status?: BranchStatus } = {},
  ): Observable<Paginated<Branch>> {
    let httpParams = new HttpParams();
    if (params.page != null)
      httpParams = httpParams.set('page', String(params.page));
    if (params.limit != null)
      httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<Paginated<Branch>>(this.base, { params: httpParams });
  }

  options(): Observable<BranchOption[]> {
    return this.http.get<BranchOption[]>(`${this.base}/options`);
  }

  get(id: string): Observable<Branch> {
    return this.http.get<Branch>(`${this.base}/${id}`);
  }

  create(data: CreateBranchPayload): Observable<Branch> {
    return this.http.post<Branch>(this.base, data);
  }

  update(id: string, data: UpdateBranchPayload): Observable<Branch> {
    return this.http.patch<Branch>(`${this.base}/${id}`, data);
  }

  assignManager(id: string, userId: string | null): Observable<Branch> {
    return this.http.patch<Branch>(`${this.base}/${id}/manager`, { userId });
  }
}
