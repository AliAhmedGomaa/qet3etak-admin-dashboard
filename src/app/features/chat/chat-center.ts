import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../core/chat/chat.service';

@Component({
  selector: 'app-chat-center',
  imports: [FormsModule, DatePipe],
  templateUrl: './chat-center.html',
  styleUrl: './chat-center.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatCenter implements OnInit {
  protected readonly chat = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scrollBox =
    viewChild<ElementRef<HTMLDivElement>>('scrollBox');

  protected readonly draft = signal('');

  protected readonly activeConversation = computed(() => {
    const id = this.chat.activeShopId();
    return this.chat.conversations().find((c) => c.shopId === id) ?? null;
  });

  private readonly onVisibility = () =>
    this.chat.setViewing(document.visibilityState === 'visible');

  constructor() {
    effect(() => {
      this.chat.messages();
      queueMicrotask(() => this.scrollToBottom());
    });

    this.destroyRef.onDestroy(() => {
      this.chat.setViewing(false);
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
  }

  ngOnInit(): void {
    this.chat.connect();
    this.chat.loadConversations().subscribe();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  protected select(shopId: string): void {
    if (shopId === this.chat.activeShopId()) return;
    this.draft.set('');
    this.chat.openConversation(shopId);
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.chat.send(text);
    this.draft.set('');
    this.chat.notifyTyping(false);
  }

  protected onInput(value: string): void {
    this.draft.set(value);
    this.chat.notifyTyping(value.trim().length > 0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected initials(name: string): string {
    const clean = (name ?? '').trim();
    return clean ? clean.slice(0, 2) : '؟';
  }

  private scrollToBottom(): void {
    const el = this.scrollBox()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
