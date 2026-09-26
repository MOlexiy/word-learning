import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { WordCardSummary } from '@wl/shared';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { CardStorageService } from '../data/card-storage.service';
import { CardGridComponent } from '../ui/card-grid.component';

@Component({
  selector: 'wl-card-list-page',
  imports: [CardGridComponent, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>
        {{ 'cards.list.title' | transloco }} <span class="muted">({{ cards().length }})</span>
      </h1>
      <input
        class="input search"
        type="search"
        [placeholder]="'common.search' | transloco"
        [attr.aria-label]="'cards.list.searchLabel' | transloco"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
    </div>

    @if (storage.mode() === 'guest') {
      <p class="alert">
        {{ 'cards.list.guestBanner' | transloco }}
        <a routerLink="/login">{{ 'cards.list.guestBannerCta' | transloco }}</a
        >{{ 'cards.list.guestBannerTail' | transloco }}
      </p>
    }

    @switch (state()) {
      @case ('loading') {
        <p class="muted">{{ 'common.loading' | transloco }}</p>
      }
      @case ('error') {
        <p class="alert alert--error">{{ errorText() }}</p>
      }
      @default {
        @if (filtered().length) {
          <wl-card-grid [cards]="filtered()" />
        } @else if (cards().length) {
          <p class="muted">{{ 'cards.list.nothingFound' | transloco }}</p>
        } @else {
          <div class="empty">
            <p>{{ 'cards.list.empty' | transloco }}</p>
            <a class="btn btn--primary" routerLink="/cards/new">{{ 'cards.list.addFirst' | transloco }}</a>
          </div>
        }
      }
    }
  `,
})
export class CardListPage {
  protected readonly storage = inject(CardStorageService);
  readonly #errors = inject(ErrorTranslator);
  readonly #language = inject(LanguageService);

  protected readonly cards = signal<WordCardSummary[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  /** Сама помилка; текст рахується реактивно, тож перекладається при зміні мови. */
  protected readonly error = signal<unknown>(null);
  protected readonly errorText = computed(() => this.#errors.message(this.error()));
  protected readonly query = signal('');
  protected readonly filtered = computed(() => {
    const locale = this.#language.locale();
    const q = this.query().trim().toLocaleLowerCase(locale);
    return q ? this.cards().filter((card) => card.name.toLocaleLowerCase(locale).includes(q)) : this.cards();
  });

  constructor() {
    // Перезавантажуємо при зміні режиму (логін / логаут / прострочена сесія).
    effect(() => {
      this.storage.mode();
      untracked(() => void this.#load());
    });
  }

  async #load(): Promise<void> {
    this.state.set('loading');
    try {
      this.cards.set(await this.storage.list());
      this.state.set('ready');
    } catch (error: unknown) {
      this.error.set(error);
      this.state.set('error');
    }
  }
}
