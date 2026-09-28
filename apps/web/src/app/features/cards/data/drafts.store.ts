import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { AddDraftsResult, DraftInput, WordDraft } from '@wl/shared';
import { ApiDraftsRepository } from './api-drafts.repository';
import { CardStorageService } from './card-storage.service';
import type { DraftsRepository } from './drafts.repository';
import { LocalDraftsRepository } from './local-drafts.repository';

/**
 * Власна чернетка (Inbox) як спільний стан: головний екран (бейдж, список), вікно швидкого
 * додавання та створення картки з чернетки бачать ті самі дані без повторних запитів.
 * Режим (гість / акаунт) — як у CardStorageService.
 */
@Injectable({ providedIn: 'root' })
export class DraftsStore {
  readonly #cards = inject(CardStorageService);
  readonly #local = inject(LocalDraftsRepository);
  readonly #api = inject(ApiDraftsRepository);
  readonly #repo = computed<DraftsRepository>(() =>
    this.#cards.mode() === 'account' ? this.#api : this.#local,
  );

  readonly #drafts = signal<WordDraft[]>([]);
  readonly drafts = this.#drafts.asReadonly();
  readonly count = computed(() => this.#drafts().length);
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly error = signal<unknown>(null);

  #loading: Promise<void> | null = null;
  #seq = 0;

  constructor() {
    // Логін / логаут: чернетка іншого сховища.
    effect(() => {
      this.#cards.mode();
      untracked(() => {
        this.#drafts.set([]);
        this.state.set('idle');
        this.#loading = null;
      });
    });
  }

  /** Завантажує один раз для поточного режиму (повторні виклики чекають той самий запит). */
  ensureLoaded(): Promise<void> {
    if (this.state() === 'ready') return Promise.resolve();
    this.#loading ??= this.reload();
    return this.#loading;
  }

  async reload(): Promise<void> {
    const seq = ++this.#seq;
    if (this.state() !== 'ready') this.state.set('loading');
    try {
      const drafts = await this.#repo().list();
      if (seq !== this.#seq) return;
      this.#drafts.set(drafts);
      this.state.set('ready');
    } catch (error: unknown) {
      if (seq !== this.#seq) return;
      this.error.set(error);
      this.state.set('error');
      this.#loading = null;
    }
  }

  find(id: string): WordDraft | null {
    return this.#drafts().find((d) => d.id === id) ?? null;
  }

  async add(items: DraftInput[]): Promise<AddDraftsResult> {
    const result = await this.#repo().add(items);
    const ids = new Set(result.created.map((d) => d.id));
    this.#drafts.update((drafts) => [...result.created, ...drafts.filter((d) => !ids.has(d.id))]);
    return result;
  }

  async remove(draft: WordDraft): Promise<void> {
    await this.#repo().remove(draft.id);
    this.forget(draft.id);
  }

  /** «Повернути» після видалення: слово знову в чернетці (з новим id). */
  async restore(draft: WordDraft): Promise<void> {
    await this.add([{ word: draft.word, meaning: draft.meaning }]);
  }

  /** Чернетку вже прибрано на боці сховища (картку створено) — лише оновити список. */
  forget(id: string): void {
    this.#drafts.update((drafts) => drafts.filter((d) => d.id !== id));
  }
}
