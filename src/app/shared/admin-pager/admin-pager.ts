import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-admin-pager',
  templateUrl: './admin-pager.html',
  styleUrl: './admin-pager.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPager {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input(0);
  readonly limit = input(20);
  readonly itemLabel = input('عنصر');
  readonly ariaLabel = input('التنقل بين الصفحات');

  readonly pageChange = output<number>();

  protected readonly visible = computed(() => this.totalPages() > 1);

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total <= 0) return '';
    const page = this.page();
    const limit = this.limit();
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    return `عرض ${from}–${to} من ${total} ${this.itemLabel()}`;
  });

  protected readonly pageLabel = computed(
    () => `صفحة ${this.page()} من ${this.totalPages()}`,
  );

  protected readonly pages = computed(() => {
    const current = this.page();
    const total = this.totalPages();
    if (total <= 1) return [] as Array<number | 'gap'>;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const set = new Set<number>([1, total, current]);
    for (let p = current - 1; p <= current + 1; p++) {
      if (p >= 1 && p <= total) set.add(p);
    }
    if (current <= 3) {
      set.add(2);
      set.add(3);
      set.add(4);
    }
    if (current >= total - 2) {
      set.add(total - 1);
      set.add(total - 2);
      set.add(total - 3);
    }

    const sorted = [...set].sort((a, b) => a - b);
    const out: Array<number | 'gap'> = [];
    for (let i = 0; i < sorted.length; i++) {
      const n = sorted[i]!;
      if (i > 0 && n - sorted[i - 1]! > 1) out.push('gap');
      out.push(n);
    }
    return out;
  });

  protected go(next: number): void {
    const clamped = Math.min(this.totalPages(), Math.max(1, next));
    if (clamped === this.page()) return;
    this.pageChange.emit(clamped);
  }

  protected prev(): void {
    this.go(this.page() - 1);
  }

  protected next(): void {
    this.go(this.page() + 1);
  }
}
