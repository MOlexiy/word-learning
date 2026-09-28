import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { normalizeSearchText, type WordCardSummary, type WordDraft } from '@wl/shared';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { ShareService } from '../../../core/share/share.service';
import { QuickAddService } from '../../quick-add/quick-add.service';
import { CardStorageService } from '../data/card-storage.service';
import { DraftsStore } from '../data/drafts.store';
import { CardGridComponent } from '../ui/card-grid.component';
import { CardSearchComponent } from '../ui/card-search.component';
import { CollectionTabsComponent, toCollectionView } from '../ui/collection-tabs.component';
import { DraftListComponent } from '../ui/draft-list.component';

/**
 * Головний екран: «Готові картки» (грид) і «Чернетка» (швидко збережені слова).
 * Пошук іде через API (у гостя — локально) і живе в URL: `/?q=run&view=inbox`.
 */
@Component({
  selector: 'wl-card-list-page',
  imports: [
    CardGridComponent,
    CardSearchComponent,
    CollectionTabsComponent,
    DraftListComponent,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head page-head--stack">
      <h1>{{ 'cards.list.title' | transloco }}</h1>
      <wl-collection-tabs [view]="tab()" [readyCount]="total()" [inboxCount]="drafts.count()" />
    </div>

    @if (storage.mode() === 'guest') {
      <p class="alert">
        {{ 'cards.list.guestBanner' | transloco }}
        <a routerLink="/login">{{ 'cards.list.guestBannerCta' | transloco }}</a
        >{{ 'cards.list.guestBannerTail' | transloco }}
      </p>
    }

    <wl-card-search [q]="query()" [loading]="searching()" (searchChange)="applySearch($event)" />

    @if (tab() === 'cards') {
      @switch (state()) {
        @case ('loading') {
          <p class="muted">{{ 'common.loading' | transloco }}</p>
        }
        @case ('error') {
          <p class="alert alert--error">{{ errorText() }}</p>
        }
        @default {
          @if (query()) {
            <p class="muted results-note" aria-live="polite">
              {{ 'cards.search.found' | transloco: { count: cards().length } }}
            </p>
          }
          @if (cards().length) {
            <wl-card-grid [cards]="cards()" />
          } @else if (query()) {
            <p class="muted">{{ 'cards.list.nothingFound' | transloco }}</p>
          } @else {
            <div class="empty">
              <p>{{ 'cards.list.empty' | transloco }}</p>
              <a class="btn btn--primary" routerLink="/cards/new">{{ 'cards.list.addFirst' | transloco }}</a>
            </div>
          }
        }
      }
    } @else {
      @switch (drafts.state()) {
        @case ('error') {
          <p class="alert alert--error">{{ draftsErrorText() }}</p>
        }
        @case ('ready') {
          @if (visibleDrafts().length) {
            <wl-draft-list
              [drafts]="visibleDrafts()"
              [canShare]="share.canShareWithTeacher()"
              [highlightId]="draft() ?? null"
              [busyId]="removingId()"
              (fill)="fill($event)"
              (remove)="remove($event)"
              (share)="shareDraft($event)"
            />
          } @else if (drafts.count()) {
            <p class="muted">{{ 'cards.list.nothingFound' | transloco }}</p>
          } @else {
            <div class="empty">
              <p>{{ 'drafts.empty' | transloco }}</p>
              <button class="btn btn--primary" type="button" (click)="quickAdd.open()">
                {{ 'drafts.addFirst' | transloco }}
              </button>
            </div>
          }
        }
        @default {
          <p class="muted">{{ 'common.loading' | transloco }}</p>
        }
      }
    }
  `,
})
export class CardListPage {
  /** Query-параметри маршруту (withComponentInputBinding). */
  readonly q = input<string>();
  readonly view = input<string>();
  /** `?draft=<id>` — підсвітити слово в чернетці. */
  readonly draft = input<string>();

  protected readonly storage = inject(CardStorageService);
  protected readonly drafts = inject(DraftsStore);
  protected readonly quickAdd = inject(QuickAddService);
  protected readonly share = inject(ShareService);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);

  protected readonly tab = computed(() => toCollectionView(this.view()));
  protected readonly query = computed(() => (this.q() ?? '').trim());

  protected readonly cards = signal<WordCardSummary[]>([]);
  /** Кількість усіх карток (для вкладки); null — ще невідомо. */
  protected readonly total = signal<number | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly searching = signal(false);
  /** Сама помилка; текст рахується реактивно, тож перекладається при зміні мови. */
  protected readonly error = signal<unknown>(null);
  protected readonly errorText = computed(() => this.#errors.message(this.error()));
  protected readonly draftsErrorText = computed(() => this.#errors.message(this.drafts.error()));
  protected readonly removingId = signal<string | null>(null);

  /** Чернетка невелика — фільтруємо на клієнті за словом і значенням. */
  protected readonly visibleDrafts = computed(() => {
    const q = normalizeSearchText(this.query());
    const drafts = this.drafts.drafts();
    if (!q) return drafts;
    return drafts.filter(
      (d) => normalizeSearchText(d.word).includes(q) || normalizeSearchText(d.meaning).includes(q),
    );
  });

  #seq = 0;
  #loadedMode: string | null = null;

  constructor() {
    // Перезавантажуємо при зміні режиму (логін / логаут) і пошукового запиту.
    effect(() => {
      const mode = this.storage.mode();
      const query = this.query();
      untracked(() => {
        const modeChanged = mode !== this.#loadedMode;
        this.#loadedMode = mode;
        void this.#load(query, modeChanged);
      });
    });
    effect(() => {
      this.storage.mode();
      untracked(() => void this.drafts.ensureLoaded());
    });
  }

  /** Новий запит → URL (без нового запису в історії); дані підтягне effect вище. */
  protected applySearch(q: string): void {
    void this.#router.navigate([], {
      queryParams: { q: q || null, draft: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected fill(draft: WordDraft): void {
    void this.#router.navigate(['/cards/new'], { queryParams: { draft: draft.id } });
  }

  /** Без підтвердження, але з «Повернути» в тості — так швидше розбирати чернетку. */
  protected async remove(draft: WordDraft): Promise<void> {
    this.removingId.set(draft.id);
    try {
      await this.drafts.remove(draft);
      this.#notify.info(this.#transloco.translate('drafts.removed', { word: draft.word }), {
        action: {
          label: this.#transloco.translate('drafts.undo'),
          run: () =>
            void this.drafts
              .restore(draft)
              .catch((e: unknown) => this.#notify.error(this.#errors.message(e))),
        },
      });
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.removingId.set(null);
    }
  }

  protected shareDraft(draft: WordDraft): void {
    void this.share.shareDraft(draft.id, draft.word);
  }

  async #load(q: string, full: boolean): Promise<void> {
    const seq = ++this.#seq;
    if (full) this.state.set('loading');
    this.searching.set(true);
    try {
      const [cards, total] = await Promise.all([
        this.storage.list(q),
        // Загальна кількість для вкладки: окремий запит лише коли сторінку відкрито одразу з пошуком.
        q && (full || this.total() === null) ? this.storage.list().then((all) => all.length) : null,
      ]);
      if (seq !== this.#seq) return;
      this.cards.set(cards);
      if (!q) this.total.set(cards.length);
      else if (total !== null) this.total.set(total);
      this.state.set('ready');
    } catch (error: unknown) {
      if (seq !== this.#seq) return;
      this.error.set(error);
      this.state.set('error');
    } finally {
      if (seq === this.#seq) this.searching.set(false);
    }
  }
}
