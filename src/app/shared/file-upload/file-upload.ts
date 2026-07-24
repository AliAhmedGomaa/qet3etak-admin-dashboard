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
import { compressImageForUpload } from '../../core/media/compress-image';

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
  readonly hint = input('JPG · PNG · WEBP · يُضغط تلقائياً (حد أقصى ~1.5MB)');
  readonly invalid = input(false);
  readonly disabled = input(false);
  /** Change this value (e.g. increment) to clear the picker from the parent. */
  readonly resetToken = input<unknown>(null);

  readonly fileSelected = output<File | null>();

  private readonly fileInput =
    viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly dragging = signal(false);
  protected readonly compressing = signal(false);
  protected readonly localPreview = signal<string | null>(null);
  protected readonly fileName = signal<string | null>(null);

  protected readonly preview = computed(
    () => this.localPreview() ?? this.previewUrl(),
  );

  protected readonly isDisabled = computed(
    () => this.disabled() || this.compressing(),
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
    if (this.isDisabled()) return;
    this.fileInput().nativeElement.click();
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.handleFile(input.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.isDisabled()) this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.isDisabled()) return;
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) void this.handleFile(file);
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    this.localPreview.set(null);
    this.fileName.set(null);
    this.fileInput().nativeElement.value = '';
    this.fileSelected.emit(null);
  }

  private async handleFile(file: File | null): Promise<void> {
    if (!file) {
      this.fileSelected.emit(null);
      return;
    }

    this.compressing.set(true);
    try {
      const ready = await compressImageForUpload(file);
      this.fileName.set(ready.name);
      if (ready.type.startsWith('image/') && ready.type !== 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => this.localPreview.set(String(reader.result));
        reader.readAsDataURL(ready);
      } else {
        this.localPreview.set(null);
      }
      this.fileSelected.emit(ready);
    } catch {
      this.fileName.set(file.name);
      this.fileSelected.emit(file);
    } finally {
      this.compressing.set(false);
    }
  }
}
