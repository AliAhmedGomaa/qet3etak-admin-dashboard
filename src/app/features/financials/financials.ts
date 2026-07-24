import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import {
  SearchableSelect,
  SearchOption,
} from '../../shared/searchable-select/searchable-select';
import {
  CreateExpensePayload,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_AR,
  Expense,
  ExpenseCategory,
  FinancialsService,
  PnlReport,
} from '../../core/financials/financials.service';
import { ProductsAdminService } from '../../core/products/products-admin.service';
import { Product } from '../../core/products/product.models';

type RangePreset = 'today' | 'month' | 'year' | 'all';
type ModalTab = 'expense' | 'damaged';

@Component({
  selector: 'app-financials',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, SearchableSelect],
  templateUrl: './financials.html',
  styleUrl: './financials.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Financials implements OnInit {
  private readonly api = inject(FinancialsService);
  private readonly productsApi = inject(ProductsAdminService);

  protected readonly report = signal<PnlReport | null>(null);
  protected readonly expenses = signal<Expense[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly preset = signal<RangePreset>('month');

  protected readonly products = signal<Product[]>([]);

  // Modal state
  protected readonly modalOpen = signal(false);
  protected readonly modalTab = signal<ModalTab>('expense');
  protected readonly saving = signal(false);
  protected readonly modalError = signal<string | null>(null);

  protected expenseForm: CreateExpensePayload = {
    category: 'RENT',
    amount: 0,
    date: this.today(),
    description: '',
  };
  protected damagedForm = { productId: '', quantity: 1, description: '' };

  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly categoryAr = EXPENSE_CATEGORY_AR;

  protected readonly categoryOptions: SearchOption[] = EXPENSE_CATEGORIES.map(
    (c) => ({ value: c, label: EXPENSE_CATEGORY_AR[c] }),
  );

  protected readonly productOptions = computed<SearchOption[]>(() =>
    this.products().map((p) => ({
      value: p.id,
      label: p.title,
      hint: `${p.stockQuantity} متاح`,
    })),
  );

  private readonly barCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('barCanvas');
  private readonly doughnutCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('doughnutCanvas');
  private barChart?: Chart;
  private doughnutChart?: Chart;

  protected readonly presets: Array<{ id: RangePreset; label: string }> = [
    { id: 'today', label: 'اليوم' },
    { id: 'month', label: 'هذا الشهر' },
    { id: 'year', label: 'هذه السنة' },
    { id: 'all', label: 'الكل' },
  ];

  constructor() {
    effect(() => {
      const data = this.report();
      // Touch canvas signals so the effect re-runs once the view exists.
      const bar = this.barCanvas();
      const doughnut = this.doughnutCanvas();
      if (data && bar && doughnut) {
        this.renderCharts(data, bar.nativeElement, doughnut.nativeElement);
      }
    });
  }

  ngOnInit(): void {
    this.load();
    this.productsApi.list({ page: 1, limit: 100 }).subscribe({
      next: (res) => this.products.set(res.items),
      error: () => this.products.set([]),
    });
  }

  protected setPreset(preset: RangePreset): void {
    this.preset.set(preset);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const { start, end } = this.rangeDates(this.preset());

    this.api.pnl(start, end).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'تعذر تحميل التقرير المالي');
        this.loading.set(false);
      },
    });

    this.api.expenses({ page: 1, limit: 50 }).subscribe({
      next: (res) => this.expenses.set(res.items),
      error: () => this.expenses.set([]),
    });
  }

  // ---- Modal ----
  protected openModal(tab: ModalTab): void {
    this.modalTab.set(tab);
    this.modalError.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected saveExpense(): void {
    if (!this.expenseForm.amount || this.expenseForm.amount <= 0) {
      this.modalError.set('أدخل مبلغاً صحيحاً');
      return;
    }
    this.saving.set(true);
    this.modalError.set(null);
    this.api.createExpense({ ...this.expenseForm }).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.expenseForm = {
          category: 'RENT',
          amount: 0,
          date: this.today(),
          description: '',
        };
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.modalError.set(err?.error?.message || 'تعذر حفظ المصروف');
      },
    });
  }

  protected saveDamaged(): void {
    if (!this.damagedForm.productId) {
      this.modalError.set('اختر المنتج');
      return;
    }
    if (!this.damagedForm.quantity || this.damagedForm.quantity < 1) {
      this.modalError.set('أدخل كمية صحيحة');
      return;
    }
    this.saving.set(true);
    this.modalError.set(null);
    this.api.recordDamagedStock({ ...this.damagedForm }).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.damagedForm = { productId: '', quantity: 1, description: '' };
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.modalError.set(err?.error?.message || 'تعذر تسجيل التالف');
      },
    });
  }

  protected removeExpense(id: string): void {
    this.api.removeExpense(id).subscribe({ next: () => this.load() });
  }

  private renderCharts(
    data: PnlReport,
    barEl: HTMLCanvasElement,
    doughnutEl: HTMLCanvasElement,
  ): void {
    this.barChart?.destroy();
    this.doughnutChart?.destroy();

    this.barChart = new Chart(barEl, {
      type: 'bar',
      data: {
        labels: ['الإيرادات', 'تكلفة البضاعة', 'إجمالي الربح', 'المصروفات', 'صافي الربح'],
        datasets: [
          {
            label: 'ج.م',
            data: [
              data.totalRevenue,
              data.totalCogs,
              data.grossProfit,
              data.totalExpenses,
              data.netProfit,
            ],
            backgroundColor: [
              '#10b880',
              '#f59e0b',
              '#3b82f6',
              '#ef4444',
              data.netProfit >= 0 ? '#059669' : '#dc2626',
            ],
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
    });

    const byCat = data.expensesByCategory;
    this.doughnutChart = new Chart(doughnutEl, {
      type: 'doughnut',
      data: {
        labels: byCat.map((c) => this.categoryAr[c.category]),
        datasets: [
          {
            data: byCat.map((c) => c.amount),
            backgroundColor: [
              '#ef4444',
              '#f59e0b',
              '#3b82f6',
              '#8b5cf6',
              '#14b8a6',
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  private rangeDates(preset: RangePreset): {
    start?: string;
    end?: string;
  } {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const end = fmt(now);
    switch (preset) {
      case 'today':
        return { start: end, end };
      case 'month':
        return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end };
      case 'year':
        return { start: fmt(new Date(now.getFullYear(), 0, 1)), end };
      case 'all':
      default:
        return {};
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  protected categoryLabel(cat: ExpenseCategory): string {
    return this.categoryAr[cat];
  }
}
