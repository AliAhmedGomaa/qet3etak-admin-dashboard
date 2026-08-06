import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ShopUser } from '../../core/auth/auth.models';
import { Product } from '../../core/products/product.models';
import { ProductsAdminService } from '../../core/products/products-admin.service';
import { ShopsAdminService } from '../../core/shops/shops-admin.service';
import {
  AdminSalesService,
  SoldTodayLine,
  SoldTodayResponse,
  WalkInSaleItem,
} from '../../core/sales/admin-sales.service';

type CartLine = {
  productId: string;
  title: string;
  sku: string;
  stockQuantity: number;
  basePrice: number;
  quantity: number;
  unitPrice: number;
};

type CustomerMode = 'walkin' | 'shop';

@Component({
  selector: 'app-sales-today',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './sales-today.html',
  styleUrl: './sales-today.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTodayPage implements OnInit {
  private readonly salesApi = inject(AdminSalesService);
  private readonly productsApi = inject(ProductsAdminService);
  private readonly shopsApi = inject(ShopsAdminService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly data = signal<SoldTodayResponse | null>(null);

  protected readonly sellOpen = signal(false);
  protected readonly customerMode = signal<CustomerMode>('walkin');
  protected readonly productQuery = signal('');
  protected readonly productHits = signal<Product[]>([]);
  protected readonly searching = signal(false);
  protected readonly shopQuery = signal('');
  protected readonly shopHits = signal<ShopUser[]>([]);
  protected readonly searchingShops = signal(false);
  protected readonly selectedShop = signal<ShopUser | null>(null);
  protected readonly cart = signal<CartLine[]>([]);
  protected customerName = '';
  protected customerPhone = '';
  protected notes = '';
  protected paymentMethod: 'CASH' | 'CREDIT' = 'CASH';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private shopSearchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly canSell = computed(() => this.auth.can('orders.create'));

  protected readonly cartTotal = computed(() =>
    this.cart().reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  );

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.salesApi.soldToday().subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل مبيعات اليوم');
      },
    });
  }

  protected sourceLabel(source: string): string {
    return source === 'WALK_IN' ? 'بيع مباشر' : 'جملة';
  }

  protected paymentLabel(method: string): string {
    if (method === 'CASH') return 'نقدي';
    if (method === 'CREDIT') return 'آجل';
    if (method === 'CASH_ON_DELIVERY') return 'دفع عند الاستلام';
    return method || '—';
  }

  protected openSell(): void {
    this.cart.set([]);
    this.productHits.set([]);
    this.productQuery.set('');
    this.shopHits.set([]);
    this.shopQuery.set('');
    this.selectedShop.set(null);
    this.customerMode.set('walkin');
    this.customerName = '';
    this.customerPhone = '';
    this.notes = '';
    this.paymentMethod = 'CASH';
    this.success.set(null);
    this.error.set(null);
    this.sellOpen.set(true);
  }

  protected closeSell(): void {
    if (this.saving()) return;
    this.sellOpen.set(false);
  }

  protected setCustomerMode(mode: CustomerMode): void {
    this.customerMode.set(mode);
    this.error.set(null);
    if (mode === 'walkin') {
      this.selectedShop.set(null);
      this.shopHits.set([]);
      this.shopQuery.set('');
      this.paymentMethod = 'CASH';
    } else {
      this.customerName = '';
      this.customerPhone = '';
    }
  }

  protected onShopSearch(value: string): void {
    this.shopQuery.set(value);
    if (this.shopSearchTimer) clearTimeout(this.shopSearchTimer);
    const q = value.trim();
    if (q.length < 2) {
      this.shopHits.set([]);
      this.searchingShops.set(false);
      return;
    }
    this.shopSearchTimer = setTimeout(() => {
      this.searchingShops.set(true);
      this.shopsApi.list({ q, status: 'APPROVED', limit: 12, page: 1 }).subscribe({
        next: (res) => {
          this.shopHits.set(
            res.items.filter((s) => s.phone !== '00000000000'),
          );
          this.searchingShops.set(false);
        },
        error: () => {
          this.searchingShops.set(false);
          this.shopHits.set([]);
        },
      });
    }, 280);
  }

  protected selectShop(shop: ShopUser): void {
    this.selectedShop.set(shop);
    this.shopQuery.set(shop.shopName);
    this.shopHits.set([]);
  }

  protected clearSelectedShop(): void {
    this.selectedShop.set(null);
    this.shopQuery.set('');
    this.shopHits.set([]);
  }

  protected onProductSearch(value: string): void {
    this.productQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = value.trim();
    if (q.length < 2) {
      this.productHits.set([]);
      this.searching.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.searching.set(true);
      this.productsApi.list({ q, limit: 12, page: 1 }).subscribe({
        next: (res) => {
          this.productHits.set(res.items.filter((p) => p.isActive !== false));
          this.searching.set(false);
        },
        error: () => {
          this.searching.set(false);
          this.productHits.set([]);
        },
      });
    }, 280);
  }

  protected addProduct(p: Product): void {
    if (p.stockQuantity < 1) return;
    const discount = Number(this.selectedShop()?.shopDiscountPercent ?? 0);
    const defaultPrice =
      discount > 0
        ? Number((p.basePrice * (1 - discount / 100)).toFixed(2))
        : p.basePrice;
    const existing = this.cart().find((c) => c.productId === p.id);
    if (existing) {
      this.cart.update((rows) =>
        rows.map((r) =>
          r.productId === p.id
            ? {
                ...r,
                quantity: Math.min(r.stockQuantity, r.quantity + 1),
              }
            : r,
        ),
      );
    } else {
      this.cart.update((rows) => [
        ...rows,
        {
          productId: p.id,
          title: p.title,
          sku: p.sku || '',
          stockQuantity: p.stockQuantity,
          basePrice: p.basePrice,
          quantity: 1,
          unitPrice: defaultPrice,
        },
      ]);
    }
    this.productQuery.set('');
    this.productHits.set([]);
  }

  protected setQty(productId: string, raw: string | number): void {
    const qty = Math.max(1, Math.floor(Number(raw) || 1));
    this.cart.update((rows) =>
      rows.map((r) =>
        r.productId === productId
          ? { ...r, quantity: Math.min(r.stockQuantity, qty) }
          : r,
      ),
    );
  }

  protected setPrice(productId: string, raw: string | number): void {
    const price = Math.max(0, Number(raw) || 0);
    this.cart.update((rows) =>
      rows.map((r) =>
        r.productId === productId ? { ...r, unitPrice: price } : r,
      ),
    );
  }

  protected removeLine(productId: string): void {
    this.cart.update((rows) => rows.filter((r) => r.productId !== productId));
  }

  protected submitSale(): void {
    const items: WalkInSaleItem[] = this.cart().map((c) => ({
      productId: c.productId,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
    }));
    if (!items.length) {
      this.error.set('أضف قطعة واحدةلاً للبيع');
      return;
    }
    const mode = this.customerMode();
    const shop = this.selectedShop();
    if (mode === 'shop' && !shop) {
      this.error.set('اختر متجراً مسجّلاً');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.salesApi
      .walkIn({
        items,
        shopId: mode === 'shop' ? shop!.id : undefined,
        paymentMethod:
          mode === 'shop' ? this.paymentMethod : 'CASH',
        customerName:
          mode === 'walkin'
            ? this.customerName.trim() || undefined
            : undefined,
        customerPhone:
          mode === 'walkin'
            ? this.customerPhone.trim() || undefined
            : undefined,
        notes: this.notes.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.sellOpen.set(false);
          this.success.set(
            mode === 'shop'
              ? `تم تسجيل البيع للمتجر ${shop!.shopName}`
              : 'تم تسجيل البيع المباشر بنجاح',
          );
          this.reload();
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          this.saving.set(false);
          const msg = err.error?.message;
          this.error.set(
            Array.isArray(msg)
              ? msg.join(' · ')
              : typeof msg === 'string'
                ? msg
                : 'تعذر إتمام البيع',
          );
        },
      });
  }

  protected trackLine(_i: number, line: SoldTodayLine): string {
    return `${line.orderId}-${line.productId}-${line.createdAt}`;
  }
}
