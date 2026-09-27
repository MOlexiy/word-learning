import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { buildImageQuery, type CardImage, type WordCard } from '@wl/shared';
import { ImagesApi } from '../data/images.api';

/** Скільки сторінок результатів Pexels перебирати для «Інша картинка». */
const MAX_PAGES = 5;

/**
 * Ілюстрація до «Прикладу вживання». Для власника картки: якщо картинки ще немає, перша
 * знайдена за ключовими словами прикладу підставляється автоматично (і зберігається батьком
 * через `imageChange`), далі — «Інша картинка» / «Прибрати». У режимі перегляду (вчитель) —
 * лише збережена картинка.
 */
@Component({
  selector: 'wl-card-image',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = card();
    @if (c.image && !broken()) {
      <figure class="card-image">
        <img
          class="card-image__img"
          [src]="c.image.url"
          [alt]="c.used || c.name"
          loading="lazy"
          referrerpolicy="no-referrer"
          (error)="onImageError()"
        />
        <figcaption class="card-image__caption">
          <a [href]="c.image.pageUrl" target="_blank" rel="noopener noreferrer">
            {{ 'cards.image.credit' | transloco: { author: c.image.author || 'Pexels' } }}
          </a>
          @if (editable() && !unavailable()) {
            <span class="spacer"></span>
            <button type="button" class="btn btn--small" [disabled]="loading()" (click)="another()">
              {{ 'cards.image.another' | transloco }}
            </button>
            <button
              type="button"
              class="btn btn--small"
              [disabled]="loading()"
              (click)="imageChange.emit(null)"
            >
              {{ 'cards.image.remove' | transloco }}
            </button>
          }
        </figcaption>
        @if (noMore()) {
          <p class="hint muted">{{ 'cards.image.noMore' | transloco }}</p>
        }
      </figure>
    } @else if (loading()) {
      <div class="card-image__placeholder muted">{{ 'cards.image.searching' | transloco }}</div>
    } @else if (editable() && !unavailable()) {
      @if (noMore()) {
        <p class="hint muted">{{ 'cards.image.notFound' | transloco }}</p>
      } @else {
        <button type="button" class="btn btn--small card-image__pick" (click)="another()">
          {{ 'cards.image.pick' | transloco }}
        </button>
      }
    }
  `,
})
export class CardImageComponent {
  readonly card = input.required<WordCard>();
  /** Власник картки може підбирати/прибирати картинку. */
  readonly editable = input(false);
  /** Нова картинка (зберегти) або `null` (прибрати). */
  readonly imageChange = output<CardImage | null>();

  readonly #api = inject(ImagesApi);

  protected readonly loading = signal(false);
  protected readonly noMore = signal(false);
  /** Пошук вимкнено на сервері (немає ключа) або недоступний — ховаємо кнопки. */
  protected readonly unavailable = signal(false);
  /** Збережене посилання більше не відкривається (фото видалили з Pexels). */
  protected readonly broken = signal(false);

  #cardId: string | null = null;
  #autoTried = false;
  #query = '';
  #page = 0;
  #exhausted = false;
  #usedFallback = false;
  #queue: CardImage[] = [];
  readonly #seen = new Set<string>();

  constructor() {
    effect(() => {
      const card = this.card();
      const editable = this.editable();
      untracked(() => {
        if (card.id !== this.#cardId) this.#reset(card.id);
        if (card.image) this.#seen.add(card.image.url);
        if (editable && !card.image && !card.imageHidden && !this.#autoTried) {
          this.#autoTried = true;
          void this.#pickNext({ auto: true });
        }
      });
    });
  }

  protected another(): void {
    void this.#pickNext({ auto: false });
  }

  protected onImageError(): void {
    this.broken.set(true);
    if (this.editable()) void this.#pickNext({ auto: true });
  }

  async #pickNext({ auto }: { auto: boolean }): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.noMore.set(false);
    const cardId = this.card().id;
    try {
      const next = await this.#nextCandidate();
      if (cardId !== this.card().id) return;
      if (next) {
        this.#seen.add(next.url);
        this.broken.set(false);
        this.imageChange.emit(next);
      } else if (!auto || !this.card().image) {
        this.noMore.set(true);
      }
    } catch {
      // Немає ключа / Pexels недоступний: функція просто не показується.
      this.unavailable.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async #nextCandidate(): Promise<CardImage | null> {
    const { used, name } = this.card();
    const query = buildImageQuery(used, name);
    if (query !== this.#query && !this.#usedFallback) this.#resetSearch(query);

    for (;;) {
      const candidate = this.#queue.shift();
      if (candidate) {
        if (!this.#seen.has(candidate.url)) return candidate;
        continue;
      }
      if (this.#exhausted) {
        // Приклад дав замало результатів — шукаємо просто за словом.
        const fallback = name.trim();
        if (this.#usedFallback || !fallback || fallback.toLowerCase() === this.#query.toLowerCase())
          return null;
        this.#resetSearch(fallback);
        this.#usedFallback = true;
      }
      this.#page++;
      const { images } = await this.#api.search(this.#query, this.#page);
      this.#queue.push(...images);
      if (!images.length || this.#page >= MAX_PAGES) this.#exhausted = true;
    }
  }

  #resetSearch(query: string): void {
    this.#query = query;
    this.#page = 0;
    this.#exhausted = false;
    this.#queue = [];
  }

  #reset(cardId: string): void {
    this.#cardId = cardId;
    this.#autoTried = false;
    this.#usedFallback = false;
    this.#seen.clear();
    this.#resetSearch('');
    this.noMore.set(false);
    this.broken.set(false);
  }
}
