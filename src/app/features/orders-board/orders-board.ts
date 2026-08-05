import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminCommerceService,
  AdminOrder,
  OrderStatus,
} from '../../core/commerce/admin-commerce.service';
import {
  DeliveryGuy,
  DeliveryGuysAdminService,
} from '../../core/delivery/delivery-guys-admin.service';
import { orderStatusAr, paymentMethodAr } from '../../core/i18n/ar-labels';
import { AdminPager } from '../../shared/admin-pager/admin-pager';

const COLUMNS: Array<{ status: OrderStatus; title: string }> = [
  { status: 'RECEIVED', title: orderStatusAr['RECEIVED'] },
  { status: 'SHIPPED', title: orderStatusAr['SHIPPED'] },
  { status: 'DELIVERED', title: orderStatusAr['DELIVERED'] },
];

@Component({
  selector: 'app-orders-board',
  imports: [CurrencyPipe, DatePipe, FormsModule, AdminPager],
  templateUrl: './orders-board.html',
  styleUrl: './orders-board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersBoard implements OnInit {
  private readonly api = inject(AdminCommerceService);
  private readonly deliveryApi = inject(DeliveryGuysAdminService);

  protected readonly columns = COLUMNS;
  protected readonly orders = signal<AdminOrder[]>([]);
  protected readonly deliveryGuys = signal<DeliveryGuy[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly draggingId = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly searchQuery = signal('');
  protected searchDraft = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly assignTarget = signal<AdminOrder | null>(null);
  protected readonly pendingStatus = signal<OrderStatus | null>(null);
  protected assignGuyId = '';
  protected readonly assigning = signal(false);

  ngOnInit(): void {
    this.load();
    this.deliveryApi.list({ page: 1, limit: 100 }).subscribe({
      next: (res) => this.deliveryGuys.set(res.items ?? []),
      error: () => this.error.set('تعذر تحميل مندوبي التوصيل'),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .orders({ page: this.page(), limit: 100, q: this.searchQuery() || undefined })
      .subscribe({
        next: (res) => {
          this.orders.set(res.items);
          this.page.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('تعذر تحميل الطلبات');
        },
      });
  }

  protected onSearchInput(value: string): void {
    this.searchDraft = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      const next = value.trim();
      if (next === this.searchQuery()) return;
      this.searchQuery.set(next);
      this.page.set(1);
      this.load();
    }, 320);
  }

  protected clearSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchDraft = '';
    if (!this.searchQuery()) return;
    this.searchQuery.set('');
    this.page.set(1);
    this.load();
  }

  protected goPage(next: number): void {
    const page = Math.min(this.totalPages(), Math.max(1, next));
    if (page === this.page()) return;
    this.page.set(page);
    this.load();
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

    if (status === 'SHIPPED' && !order.deliveryGuyId && this.deliveryGuys().length) {
      this.assignTarget.set(order);
      this.pendingStatus.set('SHIPPED');
      this.assignGuyId = '';
      return;
    }

    this.applyStatus(id, status);
  }

  protected onDragEnd(): void {
    this.draggingId.set(null);
  }

  protected openAssign(order: AdminOrder): void {
    this.assignTarget.set(order);
    this.pendingStatus.set(null);
    this.assignGuyId = order.deliveryGuyId || '';
  }

  protected closeAssign(): void {
    this.assignTarget.set(null);
    this.pendingStatus.set(null);
    this.assignGuyId = '';
  }

  protected confirmAssign(): void {
    const order = this.assignTarget();
    if (!order || !this.assignGuyId) return;
    this.assigning.set(true);
    const nextStatus = this.pendingStatus();

    const request$ = nextStatus
      ? this.api.updateOrderStatus(order.id, nextStatus, undefined, this.assignGuyId)
      : this.api.assignDelivery(order.id, this.assignGuyId);

    request$.subscribe({
      next: (updated) => {
        this.assigning.set(false);
        this.closeAssign();
        this.orders.update((list) =>
          list.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
        );
      },
      error: () => {
        this.assigning.set(false);
        this.error.set('فشل تعيين المندوب');
        this.load();
      },
    });
  }

  private applyStatus(id: string, status: OrderStatus): void {
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
}
