import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const ENABLED_KEY = 'qet3etak.admin.push.enabled';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  /** Optional — only available when `provideServiceWorker` is registered. */
  private readonly swPush = inject(SwPush, { optional: true });

  readonly enabled = signal(this.readEnabled());
  readonly supported = signal(this.isPushSupported());
  readonly busy = signal(false);
  readonly lastError = signal<string | null>(null);

  async enable(): Promise<boolean> {
    this.busy.set(true);
    this.lastError.set(null);
    this.supported.set(this.isPushSupported());
    console.info('[push:admin] enable start', {
      supported: this.supported(),
      swPush: !!this.swPush,
      swEnabled: this.swPush?.isEnabled ?? false,
      permission:
        typeof Notification !== 'undefined' ? Notification.permission : 'n/a',
    });
    try {
      if (!this.swPush || !this.swPush.isEnabled) {
        this.lastError.set(
          'خدمة الإشعارات غير مفعّلة (استخدم نسخة الإنتاج / HTTPS)',
        );
        console.warn('[push:admin] enable aborted — SW not enabled');
        return false;
      }

      const permission = await Notification.requestPermission();
      console.info('[push:admin] permission=', permission);
      if (permission !== 'granted') {
        this.lastError.set('تم رفض إذن الإشعارات');
        return false;
      }

      const key = await this.resolveVapidPublicKey();
      console.info('[push:admin] vapid key length=', key?.length ?? 0);
      if (!key) {
        this.lastError.set('مفتاح الإشعارات غير متوفر على الخادم');
        return false;
      }

      const sub = await this.swPush.requestSubscription({
        serverPublicKey: key,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.['p256dh'] || !json.keys?.['auth']) {
        this.lastError.set('تعذر إنشاء اشتراك الإشعارات في المتصفح');
        console.warn('[push:admin] incomplete subscription JSON', json);
        return false;
      }

      console.info('[push:admin] posting subscribe', {
        endpointHost: (() => {
          try {
            return new URL(json.endpoint!).host;
          } catch {
            return 'invalid';
          }
        })(),
      });
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/admin/push/subscribe`, {
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      );
      this.enabled.set(true);
      localStorage.setItem(ENABLED_KEY, '1');
      console.info('[push:admin] enable OK');
      return true;
    } catch (err) {
      this.lastError.set(this.formatError(err));
      console.error('[push:admin] enable FAILED', err);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    if (!this.swPush) {
      this.enabled.set(false);
      localStorage.removeItem(ENABLED_KEY);
      return;
    }

    this.busy.set(true);
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/admin/push/subscribe`, {
          body: { endpoint: sub?.endpoint },
        }),
      );
      await this.swPush.unsubscribe();
    } catch {
      /* ignore */
    } finally {
      this.enabled.set(false);
      localStorage.removeItem(ENABLED_KEY);
      this.busy.set(false);
    }
  }

  async toggle(): Promise<void> {
    if (this.enabled()) await this.disable();
    else await this.enable();
  }

  private async resolveVapidPublicKey(): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ publicKey?: string; enabled?: boolean }>(
          `${environment.apiUrl}/push/vapid-public-key`,
        ),
      );
      if (res.enabled === false) {
        throw new Error('الإشعارات غير مفعّلة على الخادم (VAPID)');
      }
      if (res.publicKey?.trim()) return res.publicKey.trim();
    } catch (err) {
      if (environment.vapidPublicKey?.trim()) {
        return environment.vapidPublicKey.trim();
      }
      throw err;
    }
    return environment.vapidPublicKey?.trim() || '';
  }

  private formatError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string | string[] } }).error;
      const msg = body?.message;
      if (Array.isArray(msg)) return msg.join(' · ');
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    if (err instanceof Error && err.message.trim()) return err.message;
    return 'تعذر تفعيل الإشعارات';
  }

  private isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      this.swPush != null
    );
  }

  private readEnabled(): boolean {
    try {
      return localStorage.getItem(ENABLED_KEY) === '1';
    } catch {
      return false;
    }
  }
}
