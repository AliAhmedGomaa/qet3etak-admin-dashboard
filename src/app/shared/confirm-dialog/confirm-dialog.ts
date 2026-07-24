import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input('تأكيد الحذف');
  readonly message = input('');
  readonly confirmLabel = input('حذف');
  readonly cancelLabel = input('إلغاء');
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected onConfirm(): void {
    if (this.busy()) return;
    this.confirmed.emit();
  }

  protected onCancel(): void {
    if (this.busy()) return;
    this.cancelled.emit();
  }
}
