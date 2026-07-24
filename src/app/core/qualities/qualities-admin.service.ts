import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Quality } from './quality.models';
import { PageParams, Paginated } from '../pagination';

@Injectable({ providedIn: 'root' })
export class QualitiesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/qualities`;

  list(params: PageParams = {}): Observable<Paginated<Quality>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    return this.http.get<Paginated<Quality>>(this.base, { params: httpParams });
  }

  create(data: Partial<Quality>): Observable<Quality> {
    return this.http.post<Quality>(this.base, data);
  }

  update(id: string, data: Partial<Quality>): Observable<Quality> {
    return this.http.patch<Quality>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }
}
