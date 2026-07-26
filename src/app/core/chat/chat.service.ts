import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ChatConversation, ChatMessage } from './chat.models';

/** Admin-side real-time chat: many shop conversations, one open thread at a time. */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private socket: Socket | null = null;

  readonly conversations = signal<ChatConversation[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly activeShopId = signal<string | null>(null);
  readonly connected = signal(false);
  readonly typingShopId = signal<string | null>(null);

  readonly totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + (c.unreadForAdmin || 0), 0),
  );

  connect(): void {
    if (this.socket) return;
    const token = this.auth.token();
    if (!token) return;

    this.socket = io(environment.apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('message:new', (message: ChatMessage) =>
      this.onMessage(message),
    );
    this.socket.on('conversation:update', (conversation: ChatConversation) =>
      this.upsertConversation(conversation),
    );
    this.socket.on(
      'typing',
      (payload: { shopId: string; role: string; isTyping: boolean }) => {
        if (payload.role !== 'SHOP_OWNER') return;
        this.typingShopId.set(payload.isTyping ? payload.shopId : null);
      },
    );
  }

  loadConversations(): Observable<ChatConversation[]> {
    return this.http
      .get<ChatConversation[]>(`${environment.apiUrl}/admin/chat/conversations`)
      .pipe(tap((list) => this.conversations.set(list)));
  }

  openConversation(shopId: string): void {
    const previous = this.activeShopId();
    if (previous && previous !== shopId) {
      this.socket?.emit('chat:view', { shopId: previous, active: false });
    }

    this.activeShopId.set(shopId);
    this.messages.set([]);
    this.http
      .get<{ messages: ChatMessage[] }>(`${environment.apiUrl}/admin/chat/${shopId}`)
      .subscribe((res) => {
        this.messages.set(res.messages ?? []);
        this.locallyClearUnread(shopId);
      });
    this.socket?.emit('chat:view', { shopId, active: true });
  }

  /** Update whether the admin is actively looking at the open conversation. */
  setViewing(active: boolean): void {
    const shopId = this.activeShopId();
    if (!shopId) return;
    if (active) this.locallyClearUnread(shopId);
    this.socket?.emit('chat:view', { shopId, active });
  }

  send(text: string): void {
    const shopId = this.activeShopId();
    const trimmed = text.trim();
    if (!shopId || !trimmed) return;

    // Always use REST so the serverless function can finish web-push.
    // Socket.IO is only for live updates / typing (unreliable for push on Vercel).
    this.http
      .post<ChatMessage>(`${environment.apiUrl}/admin/chat/${shopId}`, {
        text: trimmed,
      })
      .subscribe({
        next: (message) => this.onMessage(message),
        error: (err) => console.error('[chat] send failed', err),
      });
  }

  notifyTyping(isTyping: boolean): void {
    const shopId = this.activeShopId();
    if (shopId && this.socket && this.connected()) {
      this.socket.emit('typing', { shopId, isTyping });
    }
  }

  private onMessage(message: ChatMessage): void {
    if (message.shopId === this.activeShopId()) {
      this.messages.update((list) =>
        list.some((m) => m.id === message.id) ? list : [...list, message],
      );
    }
    if (message.senderRole === 'SHOP_OWNER') {
      this.notifyIfBackground(
        'رسالة من متجر',
        message.text,
        message.shopId !== this.activeShopId() ||
          document.visibilityState !== 'visible',
      );
    }
  }

  private notifyIfBackground(
    title: string,
    body: string,
    force = false,
  ): void {
    if (typeof document === 'undefined' || typeof Notification === 'undefined') {
      return;
    }
    if (Notification.permission !== 'granted') return;
    if (!force && document.visibilityState === 'visible') return;
    try {
      new Notification(title, {
        body: body.slice(0, 120),
        tag: `chat-admin-local-${Date.now()}`,
        dir: 'rtl',
        lang: 'ar',
      });
    } catch {
      /* ignore */
    }
  }

  private upsertConversation(conversation: ChatConversation): void {
    this.conversations.update((list) => {
      const rest = list.filter((c) => c.shopId !== conversation.shopId);
      return [conversation, ...rest].sort(
        (a, b) =>
          new Date(b.lastMessageAt ?? 0).getTime() -
          new Date(a.lastMessageAt ?? 0).getTime(),
      );
    });
  }

  private locallyClearUnread(shopId: string): void {
    this.conversations.update((list) =>
      list.map((c) =>
        c.shopId === shopId ? { ...c, unreadForAdmin: 0 } : c,
      ),
    );
  }
}
