export type InstallPlatform =
  | 'android'
  | 'ios-safari'
  | 'unsupported'
  | 'installed';

/** Chromium `beforeinstallprompt` event (not in standard DOM typings). */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export const INSTALL_DISMISS_KEY = 'qet3etak.admin.pwa.install.dismissed';
