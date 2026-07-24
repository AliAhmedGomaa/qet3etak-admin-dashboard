import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InstallAppBanner } from './shared/install-app-banner/install-app-banner';

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
export class App {}
