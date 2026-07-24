import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

export interface SearchOption {
  value: string;
  label: string;
  /** Extra searchable/secondary text (e.g. stock count, SKU). */
  hint?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.html',
  styleUrl: './searchable-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelect),
      multi: true,
    },
  ],
})
export class SearchableSelect implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input<SearchOption[]>([]);
  readonly placeholder = input('اختر…');
  readonly searchPlaceholder = input('ابحث…');
  readonly emptyText = input('لا توجد نتائج');

  protected readonly isOpen = signal(false);
  protected readonly search = signal('');
  protected readonly value = signal<string>('');
  protected readonly isDisabled = signal(false);
  protected readonly activeIndex = signal(-1);

  private readonly searchInput =
    viewChild<ElementRef<HTMLInputElement>>('searchInput');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const opts = this.options();
    if (!q) return opts;
    return opts.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  });

  protected readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? '',
  );

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        // Focus the search field the moment the panel renders.
        queueMicrotask(() => this.searchInput()?.nativeElement.focus());
      }
    });
  }

  // ControlValueAccessor
  writeValue(value: string): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen.update((open) => !open);
    if (this.isOpen()) {
      this.search.set('');
      this.activeIndex.set(-1);
    } else {
      this.onTouched();
    }
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.activeIndex.set(value.trim() ? 0 : -1);
  }

  protected select(option: SearchOption): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const list = this.filtered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((i) => Math.min(list.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = list[this.activeIndex()];
      if (option) this.select(option);
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  private close(): void {
    this.isOpen.set(false);
    this.search.set('');
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.isOpen() &&
      !this.host.nativeElement.contains(event.target as Node)
    ) {
      this.close();
      this.onTouched();
    }
  }
}
