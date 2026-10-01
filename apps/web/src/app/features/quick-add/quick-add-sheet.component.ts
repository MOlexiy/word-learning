import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  type AddDraftsResult,
  type CardWordDuplicates,
  DRAFT_MEANING_MAX,
  DRAFTS_PER_REQUEST_MAX,
  type DraftInput,
  normalizeCardName,
  parseBulkDrafts,
  type SkippedDraft,
} from '@wl/shared';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { CardStorageService } from '../cards/data/card-storage.service';
import { DraftsStore } from '../cards/data/drafts.store';
import { type CardLink, CardDuplicatePrompts } from '../cards/ui/card-duplicate-prompts.service';
import { ProfileApi } from '../profile/profile.api';
import { type QuickAddTarget, QuickAddService } from './quick-add.service';

type Tab = 'quick' | 'bulk';

/** Підказка під формою, якщо слово не додано, бо воно вже є. */
interface SkipNotice {
  key: string;
  word: string;
  link: readonly string[] | null;
}

/**
 * «Швидко зберегти слово»: на телефоні — шторка знизу (зручно однією рукою), на десктопі — вікно.
 *  - Швидко: слово (+ необов'язкове коротке значення) → у чернетку;
 *  - Списком: кілька слів через кому / з нового рядка, «слово - значення»;
 *  - Повна картка: перехід до повної форми з уже введеним словом.
 * Для вчителя на сторінці учня слово потрапляє в чернетку учня.
 * Перед збереженням слова перевіряються по картках (власних чи учня): назва наявної картки —
 * не додаємо; слово серед n / v / adj / adv інших карток — перепитуємо (для списку — одним вікном).
 */
@Component({
  selector: 'wl-quick-add-sheet',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onBackdropClick($event)' },
  template: `
    <dialog
      #dialog
      class="sheet"
      aria-labelledby="quick-add-title"
      (cancel)="$event.preventDefault(); close()"
    >
      @if (target(); as t) {
        <div class="sheet__body">
          <div class="sheet__grip" aria-hidden="true"></div>
          <header class="sheet__head">
            <h2 id="quick-add-title" class="sheet__title">
              @if (t.kind === 'student') {
                {{ 'quickAdd.titleForStudent' | transloco: { username: t.username } }}
              } @else {
                {{ 'quickAdd.title' | transloco }}
              }
            </h2>
            <button
              type="button"
              class="icon-btn"
              [attr.aria-label]="'common.close' | transloco"
              (click)="close()"
            >
              ✕
            </button>
          </header>

          <div class="seg" role="tablist" [attr.aria-label]="'quickAdd.modeLabel' | transloco">
            <button
              type="button"
              role="tab"
              class="seg__item"
              [class.is-active]="tab() === 'quick'"
              [attr.aria-selected]="tab() === 'quick'"
              (click)="setTab('quick')"
            >
              {{ 'quickAdd.tabs.quick' | transloco }}
            </button>
            <button
              type="button"
              role="tab"
              class="seg__item"
              [class.is-active]="tab() === 'bulk'"
              [attr.aria-selected]="tab() === 'bulk'"
              (click)="setTab('bulk')"
            >
              {{ 'quickAdd.tabs.bulk' | transloco }}
            </button>
            @if (t.kind === 'self') {
              <button type="button" class="seg__item" (click)="openFullCard()">
                {{ 'quickAdd.tabs.full' | transloco }}
              </button>
            }
          </div>

          @if (tab() === 'quick') {
            <form class="stack stack--tight" [formGroup]="quickForm" (ngSubmit)="saveQuick(true)" novalidate>
              <label class="field">
                <span class="field__label">{{ 'quickAdd.word' | transloco }}</span>
                <input
                  #wordInput
                  class="input input--lg"
                  id="quick-add-word"
                  name="word"
                  formControlName="word"
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                  enterkeyhint="done"
                  lang="en"
                  maxlength="200"
                  (input)="notice.set(null)"
                />
                @if (quickForm.controls.word.touched && quickForm.controls.word.invalid) {
                  <span class="field__error">{{ 'cards.form.wordRequired' | transloco }}</span>
                }
              </label>
              <label class="field">
                <span class="field__label">{{ 'quickAdd.meaning' | transloco }}</span>
                <input
                  class="input"
                  id="quick-add-meaning"
                  name="meaning"
                  formControlName="meaning"
                  autocomplete="off"
                  enterkeyhint="done"
                  [attr.maxlength]="meaningMax"
                  [placeholder]="'quickAdd.meaningPlaceholder' | transloco"
                />
              </label>
              @if (notice(); as n) {
                <p class="alert" role="status">
                  {{ n.key | transloco: { word: n.word } }}
                  @if (n.link) {
                    <a [routerLink]="n.link" (click)="close()">{{ 'quickAdd.openCard' | transloco }}</a>
                  }
                </p>
              }
              <div class="sheet__actions">
                <button type="button" class="btn btn--ghost" [disabled]="busy()" (click)="saveQuick(false)">
                  {{ 'quickAdd.saveAndNext' | transloco }}
                </button>
                <button type="submit" class="btn btn--primary" [disabled]="busy()">
                  {{ 'quickAdd.save' | transloco }}
                </button>
              </div>
            </form>
          } @else {
            <form class="stack stack--tight" [formGroup]="bulkForm" (ngSubmit)="saveBulk()" novalidate>
              <label class="field">
                <span class="field__label">{{ 'quickAdd.bulkLabel' | transloco }}</span>
                <textarea
                  #bulkInput
                  class="input"
                  rows="6"
                  id="quick-add-bulk"
                  name="bulk"
                  autocapitalize="none"
                  spellcheck="false"
                  lang="en"
                  formControlName="text"
                  [placeholder]="'quickAdd.bulkPlaceholder' | transloco"
                ></textarea>
              </label>
              <p class="hint muted">{{ 'quickAdd.bulkHint' | transloco }}</p>
              @if (tooMany()) {
                <p class="alert alert--error">{{ 'quickAdd.bulkTooMany' | transloco: { max: bulkMax } }}</p>
              }
              @if (notice(); as n) {
                <p class="alert" role="status">{{ n.key | transloco: { word: n.word } }}</p>
              }
              <div class="sheet__actions">
                <span class="muted">{{
                  'quickAdd.bulkCount' | transloco: { count: bulkItems().length }
                }}</span>
                <span class="spacer"></span>
                <button
                  type="submit"
                  class="btn btn--primary"
                  [disabled]="busy() || !bulkItems().length || tooMany()"
                >
                  {{ 'quickAdd.bulkSave' | transloco: { count: bulkItems().length } }}
                </button>
              </div>
            </form>
          }
        </div>
      }
    </dialog>
  `,
})
export class QuickAddSheetComponent {
  protected readonly quickAdd = inject(QuickAddService);
  readonly #drafts = inject(DraftsStore);
  readonly #cards = inject(CardStorageService);
  readonly #duplicates = inject(CardDuplicatePrompts);
  readonly #profileApi = inject(ProfileApi);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);
  readonly #fb = inject(NonNullableFormBuilder);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly wordInput = viewChild<ElementRef<HTMLInputElement>>('wordInput');
  private readonly bulkInput = viewChild<ElementRef<HTMLTextAreaElement>>('bulkInput');

  protected readonly meaningMax = DRAFT_MEANING_MAX;
  protected readonly bulkMax = DRAFTS_PER_REQUEST_MAX;
  protected readonly target = this.quickAdd.target;
  protected readonly tab = signal<Tab>('quick');
  protected readonly busy = signal(false);
  protected readonly notice = signal<SkipNotice | null>(null);

  protected readonly quickForm = this.#fb.group({
    word: this.#fb.control('', [Validators.required, Validators.maxLength(200)]),
    meaning: this.#fb.control('', [Validators.maxLength(DRAFT_MEANING_MAX)]),
  });
  /** Окрема FormGroup: без неї <form> зробив би нативний submit (перезавантаження сторінки). */
  protected readonly bulkForm = this.#fb.group({ text: this.#fb.control('') });
  readonly #bulkText = toSignal(this.bulkForm.controls.text.valueChanges, { initialValue: '' });
  protected readonly bulkItems = computed(() => parseBulkDrafts(this.#bulkText()));
  protected readonly tooMany = computed(() => this.bulkItems().length > DRAFTS_PER_REQUEST_MAX);

  constructor() {
    effect(() => {
      const open = this.target() !== null;
      const dialog = this.dialog().nativeElement;
      untracked(() => {
        if (open && !dialog.open) {
          this.#resetAll();
          dialog.showModal();
          this.#focus();
        } else if (!open && dialog.open) {
          dialog.close();
        }
      });
    });
  }

  protected close(): void {
    this.quickAdd.close();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.notice.set(null);
    this.#focus();
  }

  /** «Повна картка»: переносимо вже введене слово у повну форму. */
  protected openFullCard(): void {
    const { word, meaning } = this.quickForm.getRawValue();
    const queryParams = { word: word.trim() || null, meaning: meaning.trim() || null };
    this.close();
    void this.#router.navigate(['/cards/new'], { queryParams });
  }

  /** `close` — «Зберегти» (закрити вікно); інакше «Зберегти й ще» (форма чиста, фокус на слові). */
  protected async saveQuick(close: boolean): Promise<void> {
    const target = this.target();
    if (!target || this.busy()) return;
    const { word, meaning } = this.quickForm.getRawValue();
    if (!word.trim()) {
      this.quickForm.controls.word.markAsTouched();
      this.#focus();
      return;
    }
    if (!(await this.#passesDuplicateCheck(target, word.trim()))) return;
    const result = await this.#save(target, [{ word: word.trim(), meaning: meaning.trim() }]);
    if (!result) return;

    const [created] = result.created;
    if (!created) {
      this.notice.set(this.#skipNotice(target, result.skipped[0]));
      return;
    }
    const username = target.kind === 'student' ? target.username : '';
    const key = target.kind === 'self' ? 'quickAdd.saved' : 'quickAdd.savedForStudent';
    this.#notifySaved(target, this.#transloco.translate(key, { word: created.word, username }));
    this.quickForm.reset();
    this.notice.set(null);
    if (close) this.close();
    else this.#focus();
  }

  protected async saveBulk(): Promise<void> {
    const target = this.target();
    const items = this.bulkItems();
    if (!target || this.busy() || !items.length || this.tooMany()) return;
    const picked = await this.#pickBulkItems(target, items);
    if (!picked) return;
    if (!picked.items.length) {
      this.notice.set({ key: 'quickAdd.bulkNothingNew', word: picked.declined.join(', '), link: null });
      return;
    }
    const result = await this.#save(target, picked.items);
    if (!result) return;

    const skippedWords = [...result.skipped.map((s) => s.word), ...picked.declined].join(', ');
    if (!result.created.length) {
      this.notice.set({ key: 'quickAdd.bulkNothingNew', word: skippedWords, link: null });
      return;
    }
    const saved = this.#transloco.translate('quickAdd.bulkSaved', { count: result.created.length });
    const skipped = result.skipped.length
      ? ' ' + this.#transloco.translate('quickAdd.bulkSkipped', { words: skippedWords })
      : '';
    this.#notifySaved(target, saved + skipped);
    this.bulkForm.reset();
    this.close();
  }

  /** Клік по затемненому фону (поза вмістом) = закрити. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  /**
   * true — можна додавати. Картка з такою назвою вже є — підказка з посиланням (не додаємо);
   * слово записане у формах інших карток — питаємо, чи все одно додати.
   */
  async #passesDuplicateCheck(target: QuickAddTarget, word: string): Promise<boolean> {
    this.busy.set(true);
    try {
      const [found] = await this.#findDuplicates(target, [word]);
      if (!found) return true;
      const cardLink = this.#cardLink(target);
      if (found.exact) {
        const link = cardLink(found.exact.id);
        this.notice.set({ key: 'quickAdd.skippedCard', word: found.exact.name, link });
        return false;
      }
      return await this.#duplicates.confirmRelated(word, found.related, 'draft', cardLink);
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Список: слова з точною назвою картки сервер і так пропустить, тож питаємо лише про ті, що є
   * у формах інших карток — одним вікном. null — скасовано (або помилка перевірки).
   */
  async #pickBulkItems(
    target: QuickAddTarget,
    items: DraftInput[],
  ): Promise<{ items: DraftInput[]; declined: string[] } | null> {
    this.busy.set(true);
    try {
      const found = await this.#findDuplicates(
        target,
        items.map((item) => item.word),
      );
      const related = found.filter((item) => !item.exact && item.related.length);
      if (!related.length) return { items, declined: [] };
      const choice = await this.#duplicates.chooseForList(related, this.#cardLink(target));
      if (choice === 'cancel') return null;
      if (choice === 'all') return { items, declined: [] };
      const declined = new Set(related.map((item) => normalizeCardName(item.word)));
      return {
        items: items.filter((item) => !declined.has(normalizeCardName(item.word))),
        declined: related.map((item) => item.word),
      };
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  /** Збіги серед карток власника чернетки: свої або (для вчителя) учня. */
  async #findDuplicates(target: QuickAddTarget, words: string[]): Promise<CardWordDuplicates[]> {
    if (target.kind === 'self') return this.#cards.checkDuplicatesMany(words);
    const result = await firstValueFrom(this.#profileApi.checkStudentDuplicates(target.username, words));
    return result.items;
  }

  #cardLink(target: QuickAddTarget): CardLink {
    if (target.kind === 'self') return (id) => ['/cards', id];
    const { username } = target;
    return (id) => ['/students', username, 'cards', id];
  }

  async #save(target: QuickAddTarget, items: DraftInput[]): Promise<AddDraftsResult | null> {
    this.busy.set(true);
    try {
      if (target.kind === 'self') return await this.#drafts.add(items);
      const result = await firstValueFrom(this.#profileApi.addStudentDrafts(target.username, items));
      if (result.created.length) this.quickAdd.notifyStudentSaved();
      return result;
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  #notifySaved(target: QuickAddTarget, message: string): void {
    if (target.kind === 'student') {
      this.#notify.success(message);
      return;
    }
    // Швидкий перехід до чернетки, якщо ми не на ній.
    this.#notify.success(message, {
      action: {
        label: this.#transloco.translate('quickAdd.openInbox'),
        run: () => void this.#router.navigate(['/'], { queryParams: { view: 'inbox' } }),
      },
      ttl: 5000,
    });
  }

  #skipNotice(target: QuickAddTarget, skipped: SkippedDraft | undefined): SkipNotice | null {
    if (!skipped) return null;
    if (skipped.reason === 'draft') return { key: 'quickAdd.skippedDraft', word: skipped.word, link: null };
    const link = skipped.cardId ? this.#cardLink(target)(skipped.cardId) : null;
    return { key: 'quickAdd.skippedCard', word: skipped.word, link };
  }

  #resetAll(): void {
    this.tab.set('quick');
    this.notice.set(null);
    this.quickForm.reset();
    this.bulkForm.reset();
  }

  /** Фокус після рендеру вмісту вікна (на телефоні відкриває клавіатуру). */
  #focus(): void {
    setTimeout(() => {
      const el = this.tab() === 'quick' ? this.wordInput() : this.bulkInput();
      el?.nativeElement.focus();
    });
  }
}
