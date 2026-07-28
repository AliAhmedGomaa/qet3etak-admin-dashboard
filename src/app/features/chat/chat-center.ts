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
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const shopId = params.get('shopId')?.trim();
        if (shopId && shopId !== this.chat.activeShopId()) {
          this.draft.set('');
          this.chat.openConversation(shopId);
        }
      });
  }

  ngOnInit(): void {
    this.chat.connect();
    this.chat.loadConversations().subscribe({
      next: () => {
        const shopId = this.route.snapshot.queryParamMap.get('shopId')?.trim();
        if (shopId) this.chat.openConversation(shopId);
      },
    });
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  protected select(shopId: string): void {
    if (shopId === this.chat.activeShopId()) return;
    this.draft.set('');
    this.chat.openConversation(shopId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { shopId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
