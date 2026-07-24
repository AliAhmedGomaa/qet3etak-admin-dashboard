import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category } from './category.models';
import { PageParams, Paginated } from '../pagination';

@Injectable({ providedIn: 'root' })
export class CategoriesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/categories`;

  list(params: PageParams = {}): Observable<Paginated<Category>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    return this.http.get<Paginated<Category>>(this.base, { params: httpParams });
  }

  create(data: FormData | Partial<Category>): Observable<Category> {
    return this.http.post<Category>(this.base, data);
  }

  update(id: string, data: FormData | Partial<Category>): Observable<Category> {
    return this.http.patch<Category>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }
}
