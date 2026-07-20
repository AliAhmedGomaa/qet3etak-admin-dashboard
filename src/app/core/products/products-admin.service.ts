import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from './product.models';

@Injectable({ providedIn: 'root' })
export class ProductsAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/products`;

  list(): Observable<Product[]> {
    return this.http.get<Product[]>(this.base);
  }

  create(body: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(this.base, body);
  }

  update(id: string, body: Partial<Product>): Observable<Product> {
    return this.http.patch<Product>(`${this.base}/${id}`, body);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }
}
