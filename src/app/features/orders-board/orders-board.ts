import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  AdminCommerceService,
  AdminOrder,
  OrderStatus,
} from '../../core/commerce/admin-commerce.service';
import { orderStatusAr, paymentMethodAr } from '../../core/i18n/ar-labels';

const COLUMNS: Array<{ status: OrderStatus; title: string }> = [
  { status: 'RECEIVED', title: orderStatusAr['RECEIVED'] },
  { status: 'PREPARING', title: orderStatusAr['PREPARING'] },
  { status: 'SHIPPED', title: orderStatusAr['SHIPPED'] },
  { status: 'DELIVERED', title: orderStatusAr['DELIVERED'] },
];

@Component({
  selector: 'app-orders-board',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './orders-board.html',
  styleUrl: './orders-board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersBoard implements OnInit {
  private readonly api = inject(AdminCommerceService);

  protected readonly columns = COLUMNS;
  protected readonly orders = signal<AdminOrder[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly draggingId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.orders().subscribe({
      next: (rows) => {
        this.orders.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل الطلبات');
      },
    });
  }

  protected byStatus(status: OrderStatus): AdminOrder[] {
    return this.orders().filter((o) => o.status === status);
  }

  protected paymentLabel(method: string): string {
    return paymentMethodAr[method] ?? method;
  }

  protected onDragStart(orderId: string, event: DragEvent): void {
    this.draggingId.set(orderId);
    event.dataTransfer?.setData('text/plain', orderId);
    event.dataTransfer!.effectAllowed = 'move';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  protected onDrop(status: OrderStatus, event: DragEvent): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.draggingId();
    this.draggingId.set(null);
    if (!id) return;
    const order = this.orders().find((o) => o.id === id);
    if (!order || order.status === status) return;

    // Optimistic UI
    this.orders.update((list) =>
      list.map((o) => (o.id === id ? { ...o, status } : o)),
    );

    this.api.updateOrderStatus(id, status).subscribe({
      next: (updated) => {
        this.orders.update((list) =>
          list.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
        );
      },
      error: () => {
        this.error.set('فشل تحديث حالة الطلب');
        this.load();
      },
    });
  }

  protected onDragEnd(): void {
    this.draggingId.set(null);
  }
}
