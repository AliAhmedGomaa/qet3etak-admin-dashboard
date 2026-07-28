import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import { forkJoin } from 'rxjs';
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

const CHART_COLORS = [
  '#10b880',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
  '#64748b',
];

@Component({
  selector: 'app-reports',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ReportsService);
  private readonly destroyRef = inject(DestroyRef);

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

  private readonly summaryTrendCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('summaryTrendCanvas');
  private readonly summaryMixCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('summaryMixCanvas');
  private readonly salesTrendCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('salesTrendCanvas');
  private readonly salesStatusCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('salesStatusCanvas');
  private readonly salesPaymentCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('salesPaymentCanvas');
  private readonly shopsBarCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('shopsBarCanvas');
  private readonly productsBarCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('productsBarCanvas');
  private readonly creditMovementsCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('creditMovementsCanvas');
  private readonly creditDebtCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('creditDebtCanvas');
  private readonly deliveryBarCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('deliveryBarCanvas');
  private readonly returnsStatusCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('returnsStatusCanvas');
  private readonly returnsRefundCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('returnsRefundCanvas');
  private readonly inventoryMixCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('inventoryMixCanvas');

  private charts: Chart[] = [];

  constructor() {
    this.destroyRef.onDestroy(() => this.destroyCharts());

    effect(() => {
      const tab = this.tab();
      // Touch canvases so the effect re-runs when @if mounts them.
      const summaryTrend = this.summaryTrendCanvas();
      const summaryMix = this.summaryMixCanvas();
      const salesTrend = this.salesTrendCanvas();
      const salesStatus = this.salesStatusCanvas();
      const salesPayment = this.salesPaymentCanvas();
      const shopsBar = this.shopsBarCanvas();
      const productsBar = this.productsBarCanvas();
      const creditMovements = this.creditMovementsCanvas();
      const creditDebt = this.creditDebtCanvas();
      const deliveryBar = this.deliveryBarCanvas();
      const returnsStatus = this.returnsStatusCanvas();
      const returnsRefund = this.returnsRefundCanvas();
      const inventoryMix = this.inventoryMixCanvas();

      this.destroyCharts();

      if (tab === 'summary') {
        const s = this.summary();
        const sales = this.sales();
        if (s && sales && summaryTrend && summaryMix) {
          this.renderSummaryCharts(
            s,
            sales,
            summaryTrend.nativeElement,
            summaryMix.nativeElement,
          );
        }
        return;
      }

      if (tab === 'sales') {
        const r = this.sales();
        if (r && salesTrend && salesStatus && salesPayment) {
          this.renderSalesCharts(
            r,
            salesTrend.nativeElement,
            salesStatus.nativeElement,
            salesPayment.nativeElement,
          );
        }
        return;
      }

      if (tab === 'shops') {
        const r = this.shops();
        if (r && shopsBar) this.renderShopsChart(r, shopsBar.nativeElement);
        return;
      }

      if (tab === 'products') {
        const r = this.products();
        if (r && productsBar) {
          this.renderProductsChart(r, productsBar.nativeElement);
        }
        return;
      }

      if (tab === 'credit') {
        const r = this.credit();
        if (r && creditMovements && creditDebt) {
          this.renderCreditCharts(
            r,
            creditMovements.nativeElement,
            creditDebt.nativeElement,
          );
        }
        return;
      }

      if (tab === 'delivery') {
        const r = this.delivery();
        if (r && deliveryBar) {
          this.renderDeliveryChart(r, deliveryBar.nativeElement);
        }
        return;
      }

      if (tab === 'returns') {
        const r = this.returns();
        if (r && returnsStatus && returnsRefund) {
          this.renderReturnsCharts(
            r,
            returnsStatus.nativeElement,
            returnsRefund.nativeElement,
          );
        }
        return;
      }

      if (tab === 'inventory') {
        const r = this.inventory();
        if (r && inventoryMix) {
          this.renderInventoryChart(r, inventoryMix.nativeElement);
        }
      }
    });
  }

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
        forkJoin({
          summary: this.api.summary(q),
          sales: this.api.sales(q),
        }).subscribe({
          next: ({ summary, sales }) => {
            this.summary.set(summary);
            this.sales.set(sales);
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
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { from, to };
  }

  private isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private destroyCharts(): void {
    for (const chart of this.charts) chart.destroy();
    this.charts = [];
  }

  private track(chart: Chart): Chart {
    this.charts.push(chart);
    return chart;
  }

  private renderSummaryCharts(
    summary: ReportSummary,
    sales: SalesReport,
    trendEl: HTMLCanvasElement,
    mixEl: HTMLCanvasElement,
  ): void {
    const days = sales.byDay;
    this.track(
      new Chart(trendEl, {
        type: 'line',
        data: {
          labels: days.map((d) => d.date),
          datasets: [
            {
              label: 'الإيرادات',
              data: days.map((d) => d.revenue),
              borderColor: '#10b880',
              backgroundColor: 'rgba(16, 184, 128, 0.15)',
              fill: true,
              tension: 0.35,
              yAxisID: 'y',
            },
            {
              label: 'الطلبات',
              data: days.map((d) => d.orderCount),
              borderColor: '#3b82f6',
              backgroundColor: 'transparent',
              tension: 0.35,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom' } },
          scales: {
            y: {
              beginAtZero: true,
              position: 'right',
              title: { display: true, text: 'ج.م' },
            },
            y1: {
              beginAtZero: true,
              position: 'left',
              grid: { drawOnChartArea: false },
              title: { display: true, text: 'طلبات' },
            },
          },
        },
      }),
    );

    this.track(
      new Chart(mixEl, {
        type: 'bar',
        data: {
          labels: ['الإيرادات', 'إيراد المُسلَّم', 'ديون الائتمان', 'رسوم التوصيل'],
          datasets: [
            {
              label: 'ج.م',
              data: [
                summary.revenue,
                summary.deliveredRevenue,
                summary.totalDebt,
                summary.deliveryFees,
              ],
              backgroundColor: ['#10b880', '#3b82f6', '#ef4444', '#f59e0b'],
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } },
        },
      }),
    );
  }

  private renderSalesCharts(
    r: SalesReport,
    trendEl: HTMLCanvasElement,
    statusEl: HTMLCanvasElement,
    paymentEl: HTMLCanvasElement,
  ): void {
    this.track(
      new Chart(trendEl, {
        type: 'line',
        data: {
          labels: r.byDay.map((d) => d.date),
          datasets: [
            {
              label: 'الإيرادات',
              data: r.byDay.map((d) => d.revenue),
              borderColor: '#10b880',
              backgroundColor: 'rgba(16, 184, 128, 0.12)',
              fill: true,
              tension: 0.35,
              yAxisID: 'y',
            },
            {
              label: 'الطلبات',
              data: r.byDay.map((d) => d.orderCount),
              borderColor: '#3b82f6',
              backgroundColor: 'transparent',
              tension: 0.35,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom' } },
          scales: {
            y: {
              beginAtZero: true,
              position: 'right',
              title: { display: true, text: 'ج.م' },
            },
            y1: {
              beginAtZero: true,
              position: 'left',
              grid: { drawOnChartArea: false },
              title: { display: true, text: 'طلبات' },
            },
          },
        },
      }),
    );

    this.track(
      new Chart(statusEl, {
        type: 'doughnut',
        data: {
          labels: r.byStatus.map((row) => this.labelStatus(row.status)),
          datasets: [
            {
              data: r.byStatus.map((row) => row.orderCount),
              backgroundColor: CHART_COLORS,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      }),
    );

    this.track(
      new Chart(paymentEl, {
        type: 'doughnut',
        data: {
          labels: r.byPaymentMethod.map((row) =>
            this.labelPayment(row.paymentMethod),
          ),
          datasets: [
            {
              data: r.byPaymentMethod.map((row) => row.revenue),
              backgroundColor: CHART_COLORS,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      }),
    );
  }

  private renderShopsChart(r: ShopsReport, el: HTMLCanvasElement): void {
    const top = r.items.slice(0, 10);
    this.track(
      new Chart(el, {
        type: 'bar',
        data: {
          labels: top.map((s) => s.shopName || s.shopId),
          datasets: [
            {
              label: 'الإيرادات',
              data: top.map((s) => s.revenue),
              backgroundColor: '#10b880',
              borderRadius: 8,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } },
        },
      }),
    );
  }

  private renderProductsChart(r: ProductsReport, el: HTMLCanvasElement): void {
    const top = r.items.slice(0, 10);
    this.track(
      new Chart(el, {
        type: 'bar',
        data: {
          labels: top.map((p) => p.title),
          datasets: [
            {
              label: 'الكمية',
              data: top.map((p) => p.quantitySold),
              backgroundColor: '#3b82f6',
              borderRadius: 8,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } },
        },
      }),
    );
  }

  private renderCreditCharts(
    r: CreditReport,
    movementsEl: HTMLCanvasElement,
    debtEl: HTMLCanvasElement,
  ): void {
    this.track(
      new Chart(movementsEl, {
        type: 'doughnut',
        data: {
          labels: r.movements.map((m) => this.labelTx(m.type)),
          datasets: [
            {
              data: r.movements.map((m) => m.totalAmount),
              backgroundColor: CHART_COLORS,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      }),
    );

    const topDebt = [...r.balances]
      .filter((b) => b.currentDebt > 0)
      .sort((a, b) => b.currentDebt - a.currentDebt)
      .slice(0, 10);

    this.track(
      new Chart(debtEl, {
        type: 'bar',
        data: {
          labels: topDebt.map((b) => b.shopName || b.shopId),
          datasets: [
            {
              label: 'الدين',
              data: topDebt.map((b) => b.currentDebt),
              backgroundColor: '#ef4444',
              borderRadius: 8,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } },
        },
      }),
    );
  }

  private renderDeliveryChart(r: DeliveryReport, el: HTMLCanvasElement): void {
    const top = r.byCourier.slice(0, 10);
    this.track(
      new Chart(el, {
        type: 'bar',
        data: {
          labels: top.map((c) => c.deliveryGuyName || '—'),
          datasets: [
            {
              label: 'معيّن',
              data: top.map((c) => c.deliveries),
              backgroundColor: '#94a3b8',
              borderRadius: 8,
            },
            {
              label: 'مُسلَّم',
              data: top.map((c) => c.deliveredCount),
              backgroundColor: '#10b880',
              borderRadius: 8,
            },
            {
              label: 'رسوم (ج.م)',
              data: top.map((c) => c.feesEarned),
              backgroundColor: '#3b82f6',
              borderRadius: 8,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            y: {
              beginAtZero: true,
              position: 'right',
              title: { display: true, text: 'توصيلات' },
            },
            y1: {
              beginAtZero: true,
              position: 'left',
              grid: { drawOnChartArea: false },
              title: { display: true, text: 'ج.م' },
            },
          },
        },
      }),
    );
  }

  private renderReturnsCharts(
    r: ReturnsReport,
    statusEl: HTMLCanvasElement,
    refundEl: HTMLCanvasElement,
  ): void {
    this.track(
      new Chart(statusEl, {
        type: 'doughnut',
        data: {
          labels: r.byStatus.map((row) => this.labelStatus(row.status)),
          datasets: [
            {
              data: r.byStatus.map((row) => row.returnCount),
              backgroundColor: CHART_COLORS,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      }),
    );

    this.track(
      new Chart(refundEl, {
        type: 'doughnut',
        data: {
          labels: r.byRefundMethod.map((row) =>
            this.labelRefund(row.refundMethod),
          ),
          datasets: [
            {
              data: r.byRefundMethod.map((row) => row.refundAmount),
              backgroundColor: CHART_COLORS,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      }),
    );
  }

  private renderInventoryChart(
    r: InventoryReport,
    el: HTMLCanvasElement,
  ): void {
    const ok = Math.max(
      0,
      r.summary.productCount - r.summary.outOfStock - r.summary.lowStock,
    );
    this.track(
      new Chart(el, {
        type: 'doughnut',
        data: {
          labels: ['متوفر', 'منخفض', 'نافد'],
          datasets: [
            {
              data: [ok, r.summary.lowStock, r.summary.outOfStock],
              backgroundColor: ['#10b880', '#f59e0b', '#ef4444'],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      }),
    );
  }
}
