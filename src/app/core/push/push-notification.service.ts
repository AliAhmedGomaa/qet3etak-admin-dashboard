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
    try {
      if (!this.swPush || !this.swPush.isEnabled) {
        this.lastError.set('خدمة الإشعارات غير مفعّلة (استخدم نسخة الإنتاج / HTTPS)');
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.lastError.set('تم رفض إذن الإشعارات');
        return false;
      }

      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>(
          `${environment.apiUrl}/push/vapid-public-key`,
        ),
      );
      if (!publicKey) {
        this.lastError.set('مفتاح الإشعارات غير متوفر على الخادم');
        return false;
      }

      const sub = await this.swPush.requestSubscription({
        serverPublicKey: publicKey,
      });
      const json = sub.toJSON();
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/admin/push/subscribe`, {
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      );
      this.enabled.set(true);
      localStorage.setItem(ENABLED_KEY, '1');
      return true;
    } catch (err) {
      this.lastError.set(
        err instanceof Error ? err.message : 'تعذر تفعيل الإشعارات',
      );
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

  private isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
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
