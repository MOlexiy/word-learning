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
import { firstValueFrom } from 'rxjs';
import { normalizeSearchText, pickRandom, type WordCardSummary, type WordDraft } from '@wl/shared';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { CardGridComponent } from '../cards/ui/card-grid.component';
import { CardSearchComponent } from '../cards/ui/card-search.component';
import { CollectionTabsComponent, toCollectionView } from '../cards/ui/collection-tabs.component';
import { DraftListComponent } from '../cards/ui/draft-list.component';
import { ProfileApi } from '../profile/profile.api';
import { QuickAddService } from '../quick-add/quick-add.service';
import { useStudentContext } from './student-context';

/**
 * Картки учня очима вчителя: read-only грид і чернетка учня. Вчитель може додати учню
 * «швидке слово» (кнопка тут або «+» у хедері) і прибрати слова, які додав сам.
 */
@Component({
  selector: 'wl-student-cards-page',
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
    <a routerLink="/profile" class="back">{{ 'students.back' | transloco }}</a>
    <div class="page-head">
      <h1>{{ 'students.title' | transloco: { username: studentUserName() } }}</h1>
      <div class="actions">
        <button class="btn" type="button" (click)="quickAdd.open()">
          {{ 'students.quickAdd' | transloco }}
        </button>
        <button class="btn btn--primary" type="button" [disabled]="!total()" (click)="openRandom()">
          {{ 'students.random' | transloco }}
        </button>
      </div>
    </div>
    <wl-collection-tabs [view]="tab()" [readyCount]="total()" [inboxCount]="drafts().length" />
    <p class="muted">
      {{ (tab() === 'inbox' ? 'students.draftsHint' : 'students.readonlyHint') | transloco }}
    </p>

    <wl-card-search [q]="query()" [loading]="searching()" (searchChange)="applySearch($event)" />

    @if (errorText()) {
      <p class="alert alert--error">{{ errorText() }}</p>
    } @else if (loading()) {
      <p class="muted">{{ 'common.loading' | transloco }}</p>
    } @else if (tab() === 'cards') {
      @if (query()) {
        <p class="muted results-note" aria-live="polite">
          {{ 'cards.search.found' | transloco: { count: cards().length } }}
        </p>
      }
      @if (cards().length) {
        <wl-card-grid [cards]="cards()" [basePath]="['/students', studentUserName(), 'cards']" />
      } @else if (query()) {
        <p class="muted">{{ 'cards.list.nothingFound' | transloco }}</p>
      } @else {
        <p class="muted">{{ 'students.empty' | transloco }}</p>
      }
    } @else if (visibleDrafts().length) {
      <wl-draft-list
        [drafts]="visibleDrafts()"
        [canFill]="false"
        [canDelete]="canDelete"
        [highlightId]="draft() ?? null"
        [busyId]="removingId()"
        (remove)="remove($event)"
      />
    } @else if (drafts().length) {
      <p class="muted">{{ 'cards.list.nothingFound' | transloco }}</p>
    } @else {
      <p class="muted">{{ 'students.draftsEmpty' | transloco }}</p>
    }
  `,
})
export class StudentCardsPage {
  readonly studentUserName = input.required<string>();
  /** Query-параметри маршруту (withComponentInputBinding). */
  readonly q = input<string>();
  readonly view = input<string>();
  readonly draft = input<string>();

  readonly #api = inject(ProfileApi);
  readonly #router = inject(Router);
  readonly #auth = inject(AuthService);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);
  protected readonly quickAdd = inject(QuickAddService);

  protected readonly tab = computed(() => toCollectionView(this.view()));
  protected readonly query = computed(() => (this.q() ?? '').trim());
  protected readonly cards = signal<WordCardSummary[]>([]);
  protected readonly total = signal<number | null>(null);
  protected readonly drafts = signal<WordDraft[]>([]);
  protected readonly loading = signal(true);
  protected readonly searching = signal(false);
  protected readonly removingId = signal<string | null>(null);
  /** Сама помилка; текст рахується реактивно, тож перекладається при зміні мови. */
  protected readonly error = signal<unknown>(null);
  protected readonly errorText = computed(() => this.#errors.message(this.error()));

  protected readonly visibleDrafts = computed(() => {
    const q = normalizeSearchText(this.query());
    if (!q) return this.drafts();
    return this.drafts().filter(
      (d) => normalizeSearchText(d.word).includes(q) || normalizeSearchText(d.meaning).includes(q),
    );
  });

  /** Вчитель прибирає лише слова, які додав сам. */
  protected readonly canDelete = (draft: WordDraft): boolean =>
    draft.addedBy !== null && draft.addedBy === this.#auth.user()?.username;

  #seq = 0;
  #student: string | null = null;

  constructor() {
    useStudentContext(this.studentUserName);
    effect(() => {
      const username = this.studentUserName();
      const query = this.query();
      untracked(() => {
        const studentChanged = username !== this.#student;
        this.#student = username;
        void this.#loadCards(username, query, studentChanged);
        if (studentChanged) void this.#loadDrafts(username);
      });
    });
    // Вчитель додав слово через «+» (вікно швидкого додавання).
    effect(() => {
      if (!this.quickAdd.studentSaves()) return;
      untracked(() => void this.#loadDrafts(this.studentUserName()));
    });
  }

  protected applySearch(q: string): void {
    void this.#router.navigate([], {
      queryParams: { q: q || null, draft: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Просто випадкова картка учня — без таймерів, прогресу чи запам'ятовування. */
  protected async openRandom(): Promise<void> {
    try {
      const all = this.query()
        ? await firstValueFrom(this.#api.studentCards(this.studentUserName()))
        : this.cards();
      const card = pickRandom(all);
      if (card) await this.#router.navigate(['/students', this.studentUserName(), 'cards', card.id]);
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    }
  }

  protected async remove(draft: WordDraft): Promise<void> {
    this.removingId.set(draft.id);
    try {
      await firstValueFrom(this.#api.removeStudentDraft(this.studentUserName(), draft.id), {
        defaultValue: undefined,
      });
      this.drafts.update((drafts) => drafts.filter((d) => d.id !== draft.id));
      this.#notify.info(this.#transloco.translate('drafts.removed', { word: draft.word }));
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.removingId.set(null);
    }
  }

  async #loadCards(username: string, q: string, full: boolean): Promise<void> {
    const seq = ++this.#seq;
    if (full) {
      this.loading.set(true);
      this.error.set(null);
      this.total.set(null);
    }
    this.searching.set(true);
    try {
      const [cards, total] = await Promise.all([
        firstValueFrom(this.#api.studentCards(username, q)),
        q && this.total() === null
          ? firstValueFrom(this.#api.studentCards(username)).then((all) => all.length)
          : null,
      ]);
      if (seq !== this.#seq) return;
      this.cards.set(cards);
      if (!q) this.total.set(cards.length);
      else if (total !== null) this.total.set(total);
    } catch (error: unknown) {
      if (seq === this.#seq) this.error.set(error);
    } finally {
      if (seq === this.#seq) {
        this.loading.set(false);
        this.searching.set(false);
      }
    }
  }

  async #loadDrafts(username: string): Promise<void> {
    try {
      const drafts = await firstValueFrom(this.#api.studentDrafts(username));
      if (username === this.studentUserName()) this.drafts.set(drafts);
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    }
  }
}
