import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { PwaInstallService } from '../../core/pwa/pwa-install.service';

@Component({
  selector: 'app-install-app-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './install-app-banner.html',
  styleUrl: './install-app-banner.scss',
})
export class InstallAppBanner implements OnInit, OnDestroy {
  protected readonly pwa = inject(PwaInstallService);

  private installing = false;

  ngOnInit(): void {
    this.pwa.init();
  }

  ngOnDestroy(): void {
    this.pwa.destroy();
  }

  protected async onInstallClick(): Promise<void> {
    if (this.installing) return;
    this.installing = true;
    try {
      await this.pwa.promptInstall();
    } finally {
      this.installing = false;
    }
  }

  protected onDismiss(): void {
    this.pwa.dismiss(true);
  }
}
