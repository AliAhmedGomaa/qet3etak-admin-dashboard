import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Brand } from './brand.models';
import { PageParams, Paginated } from '../pagination';

@Injectable({ providedIn: 'root' })
export class BrandsAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/brands`;

  list(params: PageParams = {}): Observable<Paginated<Brand>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    return this.http.get<Paginated<Brand>>(this.base, { params: httpParams });
  }

  create(data: FormData | Partial<Brand>): Observable<Brand> {
    return this.http.post<Brand>(this.base, data);
  }

  update(id: string, data: FormData | Partial<Brand>): Observable<Brand> {
    return this.http.patch<Brand>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }
}
