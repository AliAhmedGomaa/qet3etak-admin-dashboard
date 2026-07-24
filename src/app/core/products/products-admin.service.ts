import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from './product.models';
import { PageParams, Paginated } from '../pagination';

@Injectable({ providedIn: 'root' })
export class ProductsAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/products`;

  list(params: PageParams = {}): Observable<Paginated<Product>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    const q = params.q?.trim();
    if (q) httpParams = httpParams.set('q', q);
    return this.http.get<Paginated<Product>>(this.base, { params: httpParams });
  }

  create(data: FormData): Observable<Product> {
    return this.http.post<Product>(this.base, data);
  }

  update(id: string, data: FormData | Partial<Product>): Observable<Product> {
    return this.http.patch<Product>(`${this.base}/${id}`, data);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }
}
