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
import type { CardDuplicateRelated, CardInput, WordDraft } from '@wl/shared';
import { ConfirmService } from '../../../core/confirm/confirm.service';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { CardStorageService } from '../data/card-storage.service';
import { CardExistsError } from '../data/cards.repository';
import { DraftsStore } from '../data/drafts.store';
import { CardFormComponent } from '../ui/card-form.component';

/**
 * Нова картка. Може бути заповнена наперед:
 *  - `?draft=<id>` — з чернетки (слово + коротке значення), після створення чернетка зникає;
 *  - `?word=…&meaning=…` — з вікна швидкого додавання («Повна картка»).
 * Перед створенням перевіряє дублікати: та сама назва — не створюємо; слово у формах інших
 * карток — перепитуємо.
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
  readonly #confirm = inject(ConfirmService);
  protected readonly busy = signal(false);

  protected readonly sourceDraft = signal<WordDraft | null>(null);
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
        await this.#offerExisting(duplicates.exact.id, duplicates.exact.name);
        return;
      }
      if (duplicates.related.length && !(await this.#confirmRelated(input.name, duplicates.related))) return;

      const draft = this.sourceDraft();
      const card = await this.#storage.create(input, { fromDraftId: draft?.id });
      if (draft) this.#drafts.forget(draft.id);
      await this.#router.navigate(['/cards', card.id], { replaceUrl: true });
      this.#announceCreated(card.name, draft !== null);
    } catch (error: unknown) {
      if (error instanceof CardExistsError) await this.#offerExisting(error.cardId, error.cardName);
      else this.#notify.error(this.#errors.message(error));
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

  /** Картка з такою назвою вже є: друга не потрібна — пропонуємо перейти до наявної. */
  async #offerExisting(cardId: string, name: string): Promise<void> {
    const open = await this.#confirm.ask({
      titleKey: 'cards.duplicates.existsTitle',
      messageKey: 'cards.duplicates.existsText',
      params: { name },
      confirmKey: 'cards.duplicates.openExisting',
      cancelKey: 'common.cancel',
    });
    if (open) await this.#router.navigate(['/cards', cardId]);
  }

  /** Слово вже є у формах (n / v / adj / adv) інших карток — питаємо, чи це не та сама картка. */
  #confirmRelated(name: string, related: readonly CardDuplicateRelated[]): Promise<boolean> {
    const links = related.map((card) => ({
      label: card.name,
      hint: card.fields.join(', '),
      href: this.#router.serializeUrl(this.#router.createUrlTree(['/cards', card.id])),
    }));
    return this.#confirm.ask({
      titleKey: 'cards.duplicates.relatedTitle',
      messageKey: 'cards.duplicates.relatedText',
      params: { name },
      links,
      cancelKey: 'cards.duplicates.notCreate',
      confirmKey: 'cards.duplicates.createAnyway',
    });
  }

  async #loadDraft(id: string | undefined): Promise<void> {
    this.sourceDraft.set(null);
    if (!id) return;
    try {
      await this.#drafts.ensureLoaded();
    } catch {
      // Помилку завантаження покаже нижче «не знайдено».
    }
    if (id !== this.draft()) return;
    const draft = this.#drafts.find(id);
    if (draft) this.sourceDraft.set(draft);
    else this.#notify.info(this.#transloco.translate('drafts.notFound'));
  }
}
