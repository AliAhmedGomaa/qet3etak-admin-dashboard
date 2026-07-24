import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AdminInvoice,
  InvoicesAdminService,
} from '../../core/invoices/invoices-admin.service';

@Component({
  selector: 'app-invoice-detail-admin',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailAdmin implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(InvoicesAdminService);

  protected readonly invoice = signal<AdminInvoice | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly voiding = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api.get(id).subscribe({
      next: (inv) => this.invoice.set(inv),
      error: () => this.error.set('تعذر تحميل الفاتورة'),
    });
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      ISSUED: 'صادرة',
      PAID: 'مدفوعة',
      VOID: 'ملغاة',
    };
    return map[status] ?? status;
  }

  protected paymentLabel(method: string): string {
    return method === 'CREDIT' ? 'دفع بالآجل' : 'دفع عند الاستلام';
  }

  protected print(): void {
    window.print();
  }

  protected voidInvoice(): void {
    const inv = this.invoice();
    if (!inv || inv.status === 'VOID') return;
    this.voiding.set(true);
    this.api.void(inv.id).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
        this.voiding.set(false);
      },
      error: () => {
        this.voiding.set(false);
        this.error.set('تعذر إلغاء الفاتورة');
      },
    });
  }
}
