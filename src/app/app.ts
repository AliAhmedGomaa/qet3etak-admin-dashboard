import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InstallAppBanner } from './shared/install-app-banner/install-app-banner';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, InstallAppBanner],
  template: `
    <router-outlet />
    <app-install-app-banner />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      min-height: 100svh;
    }
  `,
})
export class App implements OnInit {
  private readonly theme = inject(ThemeService);

  ngOnInit(): void {
    this.theme.init();
  }
}
