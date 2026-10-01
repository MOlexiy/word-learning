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
import type { CardDuplicateCheck, CardInput, WordDraft } from '@wl/shared';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { CardStorageService } from '../data/card-storage.service';
import { CardExistsError } from '../data/cards.repository';
import { DraftsStore } from '../data/drafts.store';
import { CardDuplicatePrompts } from '../ui/card-duplicate-prompts.service';
import { CardFormComponent } from '../ui/card-form.component';

/**
 * Нова картка. Може бути заповнена наперед:
 *  - `?draft=<id>` — з чернетки (слово + коротке значення), після створення чернетка зникає;
 *  - `?word=…&meaning=…` — з вікна швидкого додавання («Повна картка»).
 * Перед створенням перевіряє дублікати: та сама назва — не створюємо; слово у формах інших
 * карток — перепитуємо. Для чернетки (напр. слово з читалки, де перепитати не було кого)
 * збіги показуються одразу, з кнопкою «Прибрати з чернетки».
 */
@Component({
  selector: 'wl-card-create-page',
  imports: [CardFormComponent, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sourceDraft()) {
      <a routerLink="/" [queryParams]="{ view: 'inbox' }" class="back">{{ 'drafts.back' | transloco }}</a>
    }
    <div class="page-head page-head--stack">
      <h1>{{ 'cards.create.title' | transloco }}</h1>
      @if (sourceDraft(); as d) {
        <p class="muted page-head__sub">
          {{ 'cards.create.fromDraft' | transloco: { word: d.word } }}
          @if (remainingAfter() > 0) {
            · {{ 'cards.create.draftsLeft' | transloco: { count: remainingAfter() } }}
          }
        </p>
      }
    </div>
    @if (sourceDraft(); as d) {
      @if (draftDuplicates(); as dup) {
        <div class="alert draft-duplicates" role="status">
          <p>
            {{
              (dup.exact ? 'cards.create.draftHasCard' : 'cards.create.draftRelated')
                | transloco: { word: d.word }
            }}
          </p>
          <ul>
            @if (dup.exact; as exact) {
              <li>
                <a [routerLink]="['/cards', exact.id]" lang="en">{{ exact.name }}</a>
              </li>
            }
            @for (card of dup.related; track card.id) {
              <li>
                <a [routerLink]="['/cards', card.id]" target="_blank" rel="noopener" lang="en"
                  >{{ card.name }} ↗</a
                >
                <span class="muted">{{ card.fields.join(', ') }}</span>
              </li>
            }
          </ul>
          <button type="button" class="btn btn--danger" [disabled]="busy()" (click)="removeDraft(d)">
            {{ 'cards.create.removeDraft' | transloco }}
          </button>
        </div>
      }
    }
    <section class="panel">
      <wl-card-form
        mode="create"
        submitLabel="cards.create.submit"
        [prefill]="prefill()"
        [busy]="busy()"
        (saved)="create($event)"
      />
    </section>
  `,
})
export class CardCreatePage {
  /** Query-параметри маршруту (withComponentInputBinding). */
  readonly draft = input<string>();
  readonly word = input<string>();
  readonly meaning = input<string>();

  readonly #storage = inject(CardStorageService);
  readonly #drafts = inject(DraftsStore);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);
  readonly #duplicates = inject(CardDuplicatePrompts);
  protected readonly busy = signal(false);

  protected readonly sourceDraft = signal<WordDraft | null>(null);
  /** Збіги слова з чернетки серед карток; null — збігів немає (або ще не перевірено). */
  protected readonly draftDuplicates = signal<CardDuplicateCheck | null>(null);
  protected readonly prefill = computed<Partial<CardInput> | null>(() => {
    const draft = this.sourceDraft();
    if (draft) return { name: draft.word, means: draft.meaning };
    const word = this.word()?.trim();
    const meaning = this.meaning()?.trim();
    return word || meaning ? { name: word ?? '', means: meaning ?? '' } : null;
  });
  /** Скільки слів лишиться в чернетці після цієї картки. */
  protected readonly remainingAfter = computed(() =>
    Math.max(0, this.#drafts.count() - (this.sourceDraft() ? 1 : 0)),
  );

  constructor() {
    effect(() => {
      const id = this.draft();
      this.#storage.mode();
      untracked(() => void this.#loadDraft(id));
    });
  }

  protected async create(input: CardInput): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const duplicates = await this.#storage.checkDuplicates(input.name);
      if (duplicates.exact) {
        await this.#duplicates.offerExisting(duplicates.exact.id, duplicates.exact.name);
        return;
      }
      if (
        duplicates.related.length &&
        !(await this.#duplicates.confirmRelated(input.name, duplicates.related, 'create'))
      ) {
        return;
      }

      const draft = this.sourceDraft();
      const card = await this.#storage.create(input, { fromDraftId: draft?.id });
      if (draft) this.#drafts.forget(draft.id);
      await this.#router.navigate(['/cards', card.id], { replaceUrl: true });
      this.#announceCreated(card.name, draft !== null);
    } catch (error: unknown) {
      if (error instanceof CardExistsError)
        await this.#duplicates.offerExisting(error.cardId, error.cardName);
      else this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Слово з чернетки вже є серед карток — прибрати його (з «Повернути») і перейти до наступного. */
  protected async removeDraft(draft: WordDraft): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.#drafts.remove(draft);
      this.#notify.info(this.#transloco.translate('drafts.removed', { word: draft.word }), {
        action: {
          label: this.#transloco.translate('drafts.undo'),
          run: () =>
            void this.#drafts
              .restore(draft)
              .catch((error: unknown) => this.#notify.error(this.#errors.message(error))),
        },
        ttl: 8000,
      });
      const next = this.#drafts.drafts()[0];
      await this.#router.navigate(next ? ['/cards/new'] : ['/'], {
        queryParams: next ? { draft: next.id } : { view: 'inbox' },
        replaceUrl: true,
      });
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Після картки з чернетки — запропонувати одразу наступне слово. */
  #announceCreated(name: string, fromDraft: boolean): void {
    const next = this.#drafts.drafts()[0];
    if (!fromDraft) {
      this.#notify.success(this.#transloco.translate('cards.create.created', { name }));
    } else if (next) {
      const count = this.#drafts.count();
      this.#notify.success(this.#transloco.translate('cards.create.createdNext', { count }), {
        action: {
          label: this.#transloco.translate('cards.create.fillNext'),
          run: () => void this.#router.navigate(['/cards/new'], { queryParams: { draft: next.id } }),
        },
        ttl: 10000,
      });
    } else {
      this.#notify.success(this.#transloco.translate('cards.create.inboxDone'));
    }
  }

  async #loadDraft(id: string | undefined): Promise<void> {
    this.sourceDraft.set(null);
    this.draftDuplicates.set(null);
    if (!id) return;
    try {
      await this.#drafts.ensureLoaded();
    } catch {
      // Помилку завантаження покаже нижче «не знайдено».
    }
    if (id !== this.draft()) return;
    const draft = this.#drafts.find(id);
    if (!draft) {
      this.#notify.info(this.#transloco.translate('drafts.notFound'));
      return;
    }
    this.sourceDraft.set(draft);
    await this.#checkDraft(draft);
  }

  /** Підказка, а не блокування: помилку перевірки мовчки ігноруємо (при створенні перевірка повториться). */
  async #checkDraft(draft: WordDraft): Promise<void> {
    try {
      const duplicates = await this.#storage.checkDuplicates(draft.word);
      if (this.sourceDraft()?.id !== draft.id) return;
      this.draftDuplicates.set(duplicates.exact || duplicates.related.length ? duplicates : null);
    } catch {
      // Немає підказки — не страшно.
    }
  }
}
