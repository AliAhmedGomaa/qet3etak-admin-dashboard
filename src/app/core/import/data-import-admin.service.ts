import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImportResult, ImportTemplateDocs } from './import.models';

@Injectable({ providedIn: 'root' })
export class DataImportAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/import`;

  getTemplateDocs(): Observable<ImportTemplateDocs> {
    return this.http.get<ImportTemplateDocs>(`${this.base}/template`);
  }

  preview(file: File): Observable<ImportResult> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<ImportResult>(`${this.base}/preview`, body);
  }

  commit(file: File): Observable<ImportResult> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<ImportResult>(`${this.base}/commit`, body);
  }

  downloadSampleJson(): Observable<Blob> {
    return this.http.get(`${this.base}/template.json`, {
      responseType: 'blob',
    });
  }

  downloadSampleExcel(): Observable<Blob> {
    return this.http.get(`${this.base}/template.xlsx`, {
      responseType: 'blob',
    });
  }
}
