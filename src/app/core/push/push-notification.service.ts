import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const ENABLED_KEY = 'qet3etak.admin.push.enabled';
const DEFAULT_URL = '/reports';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly swPush = inject(SwPush, { optional: true });

  readonly enabled = signal(this.readEnabled());
  readonly supported = signal(this.isPushSupported());
  readonly busy = signal(false);
  readonly lastError = signal<string | null>(null);
  private listening = false;

  async enable(): Promise<boolean> {
    this.busy.set(true);
    this.lastError.set(null);
    this.supported.set(this.isPushSupported());
    this.listenForPush();
    console.info('[push:admin] enable start', {
      supported: this.supported(),
      swPush: !!this.swPush,
      swEnabled: this.swPush?.isEnabled ?? false,
      permission:
        typeof Notification !== 'undefined' ? Notification.permission : 'n/a',
    });
    try {
      if (!this.isPushSupported()) {
        this.lastError.set(
          'خدمة الإشعارات غير مفعّلة (استخدم نسخة الإنتاج / HTTPS)',
        );
        return false;
      }

      const ready = await navigator.serviceWorker.ready;
      if (!ready) {
        this.lastError.set(
          'خدمة الإشعارات غير مفعّلة (استخدم نسخة الإنتاج / HTTPS)',
        );
        return false;
      }

      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const script = reg.active?.scriptURL || reg.waiting?.scriptURL || '';
        if (script && !script.includes('push-sw.js')) {
          await reg.unregister();
        }
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

      const existing = await ready.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {
          /* ignore */
        }
      }

      const sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      const p256dh = json.keys?.['p256dh'];
      const auth = json.keys?.['auth'];
      if (!json.endpoint || !p256dh || !auth) {
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
        p256dhLen: p256dh.length,
        authLen: auth.length,
      });
      const saved = await firstValueFrom(
        this.http.post<{
          confirmationSent?: number;
          tickleSent?: number;
        }>(`${environment.apiUrl}/admin/push/subscribe`, {
          endpoint: json.endpoint,
          keys: { p256dh, auth },
        }),
      );
      console.info('[push:admin] subscribe response', saved);
      this.enabled.set(true);
      localStorage.setItem(ENABLED_KEY, '1');

      ready.active?.postMessage({
        type: 'SHOW_LOCAL',
        title: 'اختبار Service Worker',
        body: 'إذا رأيت هذا، فـ showNotification من الـ SW يعمل',
        tag: `sw-selftest-admin-${Date.now()}`,
        data: { url: DEFAULT_URL },
      });

      this.startInboxPolling();
      void this.pullInbox();

      const serverNote = `السيرفر: tickle=${saved.tickleSent ?? 0} تأكيد=${saved.confirmationSent ?? 0}`;
      console.info('[push:admin] enable OK', serverNote);
      this.lastError.set(
        saved.tickleSent || saved.confirmationSent
          ? `تم الإرسال من السيرفر (${serverNote}). إن لم يظهر، افحص إشعارات Chrome في إعدادات النظام.`
          : `السيرفر لم يرسل (${serverNote}).`,
      );

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
    this.busy.set(true);
    try {
      const ready = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await ready?.pushManager.getSubscription();
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/admin/push/subscribe`, {
          body: { endpoint: sub?.endpoint },
        }),
      ).catch(() => undefined);
      await sub?.unsubscribe();
      if (this.swPush) {
        try {
          await this.swPush.unsubscribe();
        } catch {
          /* ignore */
        }
      }
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

  /** Enable push quietly on app start (no toggle UI). */
  async ensureEnabled(): Promise<void> {
    this.listenForPush();
    if (this.enabled() || !this.isPushSupported() || this.busy()) return;
    await this.enable();
  }

  listenForPush(): void {
    if (this.listening) return;
    this.listening = true;

    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (data?.type === 'PUSH_RECEIVED') {
          console.info('[push:admin] SW→page PUSH_RECEIVED', data.payload);
        }
        if (data?.type === 'NAVIGATE' && typeof data.url === 'string') {
          this.navigateTo(data.url);
        }
      });
    }

    this.startInboxPolling();

    if (!this.swPush?.isEnabled) return;
    this.swPush.messages.subscribe((msg) => {
      console.info('[push:admin] SwPush.messages', msg);
    });
    this.swPush.notificationClicks.subscribe((ev) => {
      const url =
        (ev.notification?.data as { url?: string } | undefined)?.url ||
        DEFAULT_URL;
      this.navigateTo(url);
    });
  }

  startInboxPolling(): void {
    if (typeof window === 'undefined') return;
    if (this.inboxTimer) return;
    void this.pullInbox();
    this.inboxTimer = window.setInterval(() => void this.pullInbox(), 8000);
  }

  private inboxTimer: number | null = null;
  private readonly seenInbox = new Set<string>();

  private async pullInbox(): Promise<void> {
    if (!this.enabled() && Notification.permission !== 'granted') return;
    try {
      const items = await firstValueFrom(
        this.http.get<
          Array<{ id: string; title: string; body: string; url?: string }>
        >(`${environment.apiUrl}/admin/push/inbox`),
      );
      if (!items?.length) return;
      const fresh = items.filter((i) => !this.seenInbox.has(i.id));
      for (const item of fresh) {
        this.seenInbox.add(item.id);
        await this.showClickableNotification(item, DEFAULT_URL);
      }
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/admin/push/inbox/read`, {
          ids: fresh.map((i) => i.id),
        }),
      ).catch(() => undefined);
    } catch (err) {
      console.warn('[push:admin] inbox poll failed', err);
    }
  }

  private async showClickableNotification(
    item: { id: string; title: string; body: string; url?: string },
    fallbackUrl: string,
  ): Promise<void> {
    const url = item.url?.startsWith('/') ? item.url : fallbackUrl;
    const ready = await navigator.serviceWorker.ready.catch(() => null);
    if (ready?.active) {
      ready.active.postMessage({
        type: 'SHOW_LOCAL',
        title: item.title,
        body: item.body,
        tag: `inbox-${item.id}`,
        data: { url },
      });
      return;
    }
    try {
      const n = new Notification(item.title, {
        body: item.body,
        tag: `inbox-${item.id}`,
        dir: 'rtl',
        lang: 'ar',
        data: { url },
      });
      n.onclick = () => {
        window.focus();
        this.navigateTo(url);
        n.close();
      };
    } catch (err) {
      console.warn('[push:admin] inbox Notification failed', err);
    }
  }

  private navigateTo(url: string): void {
    const path = url.startsWith('/') ? url : DEFAULT_URL;
    void this.router.navigateByUrl(path);
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
      'PushManager' in window
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
