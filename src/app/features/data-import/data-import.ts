import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DataImportAdminService } from '../../core/import/data-import-admin.service';
import {
  ImportEntitySummary,
  ImportResult,
  ImportRowPlan,
} from '../../core/import/import.models';

@Component({
  selector: 'app-data-import',
  templateUrl: './data-import.html',
  styleUrl: './data-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataImportPage {
  private readonly api = inject(DataImportAdminService);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly preview = signal<ImportResult | null>(null);
  protected readonly commitResult = signal<ImportResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly committing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly entityFilter = signal<'all' | 'brand' | 'category' | 'product'>(
    'all',
  );

  protected readonly activeResult = computed(
    () => this.commitResult() ?? this.preview(),
  );

  protected readonly filteredRows = computed(() => {
    const result = this.activeResult();
    if (!result) return [] as ImportRowPlan[];
    const filter = this.entityFilter();
    if (filter === 'all') return result.rows;
    return result.rows.filter((r) => r.entity === filter);
  });

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.preview.set(null);
    this.commitResult.set(null);
    this.error.set(null);
    if (file) this.runPreview();
  }

  protected clearFile(): void {
    this.selectedFile.set(null);
    this.preview.set(null);
    this.commitResult.set(null);
    this.error.set(null);
  }

  protected runPreview(): void {
    const file = this.selectedFile();
    if (!file) return;
    this.loading.set(true);
    this.error.set(null);
    this.commitResult.set(null);
    this.api.preview(file).subscribe({
      next: (res) => {
        this.preview.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractError(err));
      },
    });
  }

  protected runCommit(): void {
    const file = this.selectedFile();
    if (!file) return;
    this.committing.set(true);
    this.error.set(null);
    this.api.commit(file).subscribe({
      next: (res) => {
        this.commitResult.set(res);
        this.committing.set(false);
      },
      error: (err) => {
        this.committing.set(false);
        this.error.set(this.extractError(err));
      },
    });
  }

  protected downloadJson(): void {
    this.api.downloadSampleJson().subscribe({
      next: (blob) => this.saveBlob(blob, 'qet3etak-import-sample.json'),
      error: () => this.error.set('تعذر تنزيل نموذج JSON'),
    });
  }

  protected downloadExcel(): void {
    this.api.downloadSampleExcel().subscribe({
      next: (blob) => this.saveBlob(blob, 'qet3etak-import-template.xlsx'),
      error: () => this.error.set('تعذر تنزيل نموذج Excel'),
    });
  }

  protected actionLabel(action: string): string {
    switch (action) {
      case 'create':
        return 'إنشاء';
      case 'update':
        return 'تحديث';
      case 'reuse':
        return 'استخدام';
      case 'skip':
        return 'تخطي';
      case 'error':
        return 'خطأ';
      default:
        return action;
    }
  }

  protected entityLabel(entity: string): string {
    switch (entity) {
      case 'brand':
        return 'ماركة';
      case 'category':
        return 'فئة';
      case 'product':
        return 'منتج';
      default:
        return entity;
    }
  }

  protected summaryTotal(s: ImportEntitySummary): number {
    return s.create + s.update + s.reuse + s.skip + s.error;
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private extractError(err: unknown): string {
    const e = err as {
      error?: { message?: string | string[]; error?: string };
      message?: string;
    };
    const msg = e?.error?.message ?? e?.message;
    if (Array.isArray(msg)) return msg.join(' — ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    return 'تعذر معالجة ملف الاستيراد';
  }
}
