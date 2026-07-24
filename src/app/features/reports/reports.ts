import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreditReport,
  DeliveryReport,
  InventoryReport,
  PAYMENT_AR,
  ProductsReport,
  REFUND_AR,
  ReportSummary,
  ReportTab,
  ReportsService,
  ReturnsReport,
  STATUS_AR,
  SalesReport,
  ShopsReport,
  WALLET_TX_AR,
} from '../../core/reports/reports.service';

type RangePreset = 'today' | 'month' | 'year' | 'custom' | 'all';

@Component({
  selector: 'app-reports',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ReportsService);

  protected readonly tab = signal<ReportTab>('summary');
  protected readonly preset = signal<RangePreset>('month');
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected customFrom = '';
  protected customTo = '';

  protected readonly summary = signal<ReportSummary | null>(null);
  protected readonly sales = signal<SalesReport | null>(null);
  protected readonly shops = signal<ShopsReport | null>(null);
  protected readonly products = signal<ProductsReport | null>(null);
  protected readonly credit = signal<CreditReport | null>(null);
  protected readonly delivery = signal<DeliveryReport | null>(null);
  protected readonly returns = signal<ReturnsReport | null>(null);
  protected readonly inventory = signal<InventoryReport | null>(null);

  protected readonly page = signal(1);
  protected lowStockThreshold = 10;

  protected readonly tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'summary', label: 'نظرة عامة' },
    { id: 'sales', label: 'المبيعات' },
    { id: 'shops', label: 'أداء المتاجر' },
    { id: 'products', label: 'أداء المنتجات' },
    { id: 'credit', label: 'الائتمان' },
    { id: 'delivery', label: 'التوصيل' },
    { id: 'returns', label: 'المرتجعات' },
    { id: 'inventory', label: 'المخزون' },
  ];

  protected readonly presets: Array<{ id: RangePreset; label: string }> = [
    { id: 'today', label: 'اليوم' },
    { id: 'month', label: 'هذا الشهر' },
    { id: 'year', label: 'هذه السنة' },
    { id: 'custom', label: 'مخصص' },
    { id: 'all', label: 'الكل' },
  ];

  protected readonly statusAr = STATUS_AR;
  protected readonly paymentAr = PAYMENT_AR;
  protected readonly walletTxAr = WALLET_TX_AR;
  protected readonly refundAr = REFUND_AR;

  ngOnInit(): void {
    this.load();
  }

  protected setTab(tab: ReportTab): void {
    this.tab.set(tab);
    this.page.set(1);
    this.load();
  }

  protected setPreset(preset: RangePreset): void {
    this.preset.set(preset);
    if (preset !== 'custom') this.load();
  }

  protected applyCustom(): void {
    this.preset.set('custom');
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const q = this.query();
    const tab = this.tab();

    const fail = (err: { error?: { message?: string } }) => {
      this.error.set(err?.error?.message || 'تعذر تحميل التقرير');
      this.loading.set(false);
    };

    const done = () => this.loading.set(false);

    switch (tab) {
      case 'summary':
        this.api.summary(q).subscribe({
          next: (r) => {
            this.summary.set(r);
            done();
          },
          error: fail,
        });
        break;
      case 'sales':
        this.api.sales(q).subscribe({
          next: (r) => {
            this.sales.set(r);
            done();
          },
          error: fail,
        });
        break;
      case 'shops':
        this.api.shops({ ...q, page: this.page(), limit: 20 }).subscribe({
          next: (r) => {
            this.shops.set(r);
            done();
          },
          error: fail,
        });
        break;
      case 'products':
        this.api.products({ ...q, page: this.page(), limit: 20 }).subscribe({
          next: (r) => {
            this.products.set(r);
            done();
          },
          error: fail,
        });
        break;
      case 'credit':
        this.api.credit(q).subscribe({
          next: (r) => {
            this.credit.set(r);
            done();
          },
          error: fail,
        });
        break;
      case 'delivery':
        this.api.delivery(q).subscribe({
          next: (r) => {
            this.delivery.set(r);
            done();
          },
          error: fail,
        });
        break;
      case 'returns':
        this.api.returns(q).subscribe({
          next: (r) => {
            this.returns.set(r);
            done();
          },
          error: fail,
        });
        break;
      case 'inventory':
        this.api
          .inventory({
            page: this.page(),
            limit: 50,
            lowStockThreshold: this.lowStockThreshold,
          })
          .subscribe({
            next: (r) => {
              this.inventory.set(r);
              done();
            },
            error: fail,
          });
        break;
    }
  }

  protected exportCsv(): void {
    const tab = this.tab();
    if (tab === 'summary') return;
    this.exporting.set(true);
    const q = {
      ...this.query(),
      page: this.page(),
      lowStockThreshold: this.lowStockThreshold,
    };
    this.api.downloadCsv(tab, q).subscribe({
      next: () => this.exporting.set(false),
      error: () => {
        this.error.set('تعذر تصدير CSV');
        this.exporting.set(false);
      },
    });
  }

  protected goPage(delta: number): void {
    const next = Math.max(1, this.page() + delta);
    const max =
      this.tab() === 'shops'
        ? (this.shops()?.totalPages ?? 1)
        : this.tab() === 'products'
          ? (this.products()?.totalPages ?? 1)
          : (this.inventory()?.totalPages ?? 1);
    if (next > max) return;
    this.page.set(next);
    this.load();
  }

  protected labelStatus(s: string): string {
    return this.statusAr[s] ?? s;
  }

  protected labelPayment(s: string): string {
    return this.paymentAr[s] ?? s;
  }

  protected labelTx(s: string): string {
    return this.walletTxAr[s] ?? s;
  }

  protected labelRefund(s: string): string {
    return this.refundAr[s] ?? s;
  }

  private query(): { from?: string; to?: string } {
    const preset = this.preset();
    if (preset === 'custom') {
      return {
        from: this.customFrom || undefined,
        to: this.customTo || undefined,
      };
    }
    return this.rangeDates(preset);
  }

  private rangeDates(preset: RangePreset): { from?: string; to?: string } {
    const now = new Date();
    const to = this.isoDate(now);
    if (preset === 'all') return {};
    if (preset === 'today') return { from: to, to };
    if (preset === 'year') {
      return { from: `${now.getFullYear()}-01-01`, to };
    }
    // month
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { from, to };
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
