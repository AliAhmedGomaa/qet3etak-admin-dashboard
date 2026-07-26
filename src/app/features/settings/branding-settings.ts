import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { BrandingService } from '../../core/branding/branding.service';
import { PlatformBranding } from '../../core/branding/branding.models';

@Component({
  selector: 'app-branding-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './branding-settings.html',
  styleUrl: './branding-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingSettings implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BrandingService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly preview = signal<PlatformBranding | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    appName: ['', [Validators.required, Validators.minLength(2)]],
    tagline: [''],
    accentColor: [
      '#10b880',
      [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    ],
    accentStrongColor: [
      '#0d9a6a',
      [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    ],
    brandColor: [
      '#0f172a',
      [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)],
    ],
  });

  ngOnInit(): void {
    this.api.getAdmin().subscribe({
      next: (data) => {
        this.preview.set(data);
        this.form.patchValue({
          appName: data.appName,
          tagline: data.tagline ?? '',
          accentColor: data.accentColor,
          accentStrongColor: data.accentStrongColor,
          brandColor: data.brandColor,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('تعذر تحميل إعدادات الهوية');
      },
    });
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.update(this.form.getRawValue()).subscribe({
      next: (data) => {
        this.preview.set(data);
        this.saving.set(false);
        this.success.set('تم حفظ الهوية البصرية — تظهر في كل التطبيقات فوراً.');
      },
      error: () => {
        this.saving.set(false);
        this.error.set('تعذر حفظ الإعدادات');
      },
    });
  }

  protected onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.uploadLogo(file).subscribe({
      next: (data) => {
        this.preview.set(data);
        this.uploading.set(false);
        this.success.set('تم رفع الشعار.');
      },
      error: () => {
        this.uploading.set(false);
        this.error.set('تعذر رفع الشعار');
      },
    });
  }
}
