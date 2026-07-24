import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUpload {
  readonly accept = input('image/*');
  readonly capture = input<string | null>(null);
  /** Existing image URL to show in edit mode before a new file is picked. */
  readonly previewUrl = input<string | null>(null);
  readonly label = input('اضغط لاختيار صورة أو اسحبها هنا');
  readonly hint = input('JPG · PNG · WEBP');
  readonly invalid = input(false);
  readonly disabled = input(false);
  /** Change this value (e.g. increment) to clear the picker from the parent. */
  readonly resetToken = input<unknown>(null);

  readonly fileSelected = output<File | null>();

  private readonly fileInput =
    viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly dragging = signal(false);
  protected readonly localPreview = signal<string | null>(null);
  protected readonly fileName = signal<string | null>(null);

  protected readonly preview = computed(
    () => this.localPreview() ?? this.previewUrl(),
  );

  constructor() {
    let first = true;
    effect(() => {
      this.resetToken();
      if (first) {
        first = false;
        return;
      }
      this.localPreview.set(null);
      this.fileName.set(null);
      const el = this.fileInput().nativeElement;
      if (el) el.value = '';
    });
  }

  protected openPicker(): void {
    if (this.disabled()) return;
    this.fileInput().nativeElement.click();
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFile(input.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) this.handleFile(file);
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    this.localPreview.set(null);
    this.fileName.set(null);
    this.fileInput().nativeElement.value = '';
    this.fileSelected.emit(null);
  }

  private handleFile(file: File | null): void {
    if (!file) {
      this.fileSelected.emit(null);
      return;
    }
    this.fileName.set(file.name);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.localPreview.set(String(reader.result));
      reader.readAsDataURL(file);
    } else {
      this.localPreview.set(null);
    }
    this.fileSelected.emit(file);
  }
}
