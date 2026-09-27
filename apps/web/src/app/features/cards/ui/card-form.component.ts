import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { type CardInput, cardInputSchema, type WordCard } from '@wl/shared';
import { ConfirmService } from '../../../core/confirm/confirm.service';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { CARD_TEXT_FIELDS } from './card-fields';
import { CollocationLinksComponent } from './collocation-links.component';

/**
 * Форма картки.
 *  - create: одне поле для першого параграфа `topic`;
 *  - edit: редагування всього, крім `id` (і службового `k`), включно зі списком параграфів.
 * Остаточна валідація — тією ж Zod-схемою, що й на бекенді.
 */
@Component({
  selector: 'wl-card-form',
  imports: [ReactiveFormsModule, TranslocoPipe, CollocationLinksComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <label class="field">
        <span class="field__label">{{ 'cards.form.word' | transloco }}</span>
        <input
          class="input input--lg"
          id="card-name"
          name="name"
          formControlName="name"
          autocomplete="off"
          maxlength="200"
        />
        @if (form.controls.name.touched && form.controls.name.invalid) {
          <span class="field__error">{{ 'cards.form.wordRequired' | transloco }}</span>
        }
      </label>

      <div class="form-grid">
        @for (field of fields; track field.key) {
          <div class="field" [class.form-grid__wide]="field.multiline">
            <div class="field__head">
              <label class="field__label" [for]="'card-' + field.key">{{ field.labelKey | transloco }}</label>
              @if (field.key === 'collocations') {
                <wl-collocation-links [word]="word()" />
              }
            </div>
            @if (field.multiline) {
              <textarea
                class="input"
                rows="3"
                [id]="'card-' + field.key"
                [formControlName]="field.key"
                [attr.name]="field.key"
              ></textarea>
            } @else {
              <input
                class="input"
                [id]="'card-' + field.key"
                [formControlName]="field.key"
                [attr.name]="field.key"
                autocomplete="off"
              />
            }
          </div>
        }
      </div>

      <fieldset class="field" formArrayName="topic">
        <legend class="field__label">
          {{ (mode() === 'create' ? 'cards.form.topicFirst' : 'cards.form.topics') | transloco }}
        </legend>
        @for (control of form.controls.topic.controls; track $index; let i = $index) {
          <div class="topic-edit">
            <textarea
              class="input"
              rows="3"
              [id]="'card-topic-' + i"
              [attr.name]="'topic-' + i"
              [formControlName]="i"
              [attr.aria-label]="('cards.form.topics' | transloco) + ' ' + (i + 1)"
            ></textarea>
            @if (mode() === 'edit') {
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                (click)="removeTopic(i)"
                [attr.aria-label]="'cards.form.removeTopic' | transloco"
              >
                ✕
              </button>
            }
          </div>
        }
        @if (mode() === 'edit') {
          <button type="button" class="btn btn--ghost btn--sm" (click)="addTopic()">
            {{ 'cards.form.addTopic' | transloco }}
          </button>
        }
      </fieldset>

      @if (errorTexts().length) {
        <ul class="alert alert--error">
          @for (error of errorTexts(); track $index) {
            <li>{{ error }}</li>
          }
        </ul>
      }

      <div class="actions">
        <button type="submit" class="btn btn--primary" [disabled]="busy()">
          {{ submitLabel() | transloco }}
        </button>
        @if (mode() === 'edit') {
          <button type="button" class="btn btn--ghost" (click)="cancelled.emit()">
            {{ 'common.cancel' | transloco }}
          </button>
        }
      </div>
    </form>
  `,
})
export class CardFormComponent {
  readonly initial = input<WordCard | null>(null);
  readonly mode = input<'create' | 'edit'>('create');
  /** i18n-ключ тексту кнопки. */
  readonly submitLabel = input('common.save');
  readonly busy = input(false);

  readonly saved = output<CardInput>();
  readonly cancelled = output<void>();

  protected readonly fields = CARD_TEXT_FIELDS;
  /** Сирі помилки (i18n-ключі, тексти Zod або помилки API) — перекладаються реактивно. */
  protected readonly errors = signal<unknown[]>([]);
  protected readonly errorTexts = computed(() =>
    this.errors().map((e) => (typeof e === 'string' ? this.#errors.text(e) : this.#errors.message(e))),
  );

  readonly #fb = inject(NonNullableFormBuilder);
  readonly #errors = inject(ErrorTranslator);
  readonly #confirm = inject(ConfirmService);
  readonly #cdr = inject(ChangeDetectorRef);
  protected readonly form = this.#fb.group({
    name: this.#fb.control('', [Validators.required, Validators.maxLength(200)]),
    means: this.#fb.control(''),
    used: this.#fb.control(''),
    n: this.#fb.control(''),
    v: this.#fb.control(''),
    adj: this.#fb.control(''),
    adv: this.#fb.control(''),
    collocations: this.#fb.control(''),
    topic: this.#fb.array<FormControl<string>>([]),
  });
  /** Поточне значення поля «Слово» — для посилань на словники колокацій. */
  protected readonly word = toSignal(this.form.controls.name.valueChanges, {
    initialValue: this.form.controls.name.value,
  });

  constructor() {
    effect(() => {
      const initial = this.initial();
      untracked(() => this.#reset(initial));
    });
  }

  protected addTopic(): void {
    this.form.controls.topic.push(this.#fb.control(''));
  }

  /** Порожній параграф прибираємо одразу, заповнений — після підтвердження. Зберігається кнопкою «Зберегти». */
  protected async removeTopic(index: number): Promise<void> {
    const text = this.form.controls.topic.at(index)?.value.trim() ?? '';
    if (text) {
      const confirmed = await this.#confirm.ask({
        titleKey: 'cards.detail.deleteTopicTitle',
        messageKey: 'cards.form.removeTopicHint',
        quote: text,
        danger: true,
      });
      if (!confirmed) return;
    }
    this.form.controls.topic.removeAt(index);
    // Після await ми поза обробником події: без zone.js Angular сам не перемалює FormArray.
    this.#cdr.markForCheck();
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    const parsed = cardInputSchema.safeParse({ ...raw, topic: raw.topic.filter((t) => t.trim()) });
    if (!parsed.success) {
      this.form.markAllAsTouched();
      this.errors.set(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    this.errors.set([]);
    this.saved.emit(parsed.data);
  }

  #reset(card: WordCard | null): void {
    this.form.reset({
      name: card?.name ?? '',
      means: card?.means ?? '',
      used: card?.used ?? '',
      n: card?.n ?? '',
      v: card?.v ?? '',
      adj: card?.adj ?? '',
      adv: card?.adv ?? '',
      collocations: card?.collocations ?? '',
    });
    const topics = this.form.controls.topic;
    topics.clear();
    const paragraphs = card?.topic.length ? card.topic : [''];
    for (const paragraph of paragraphs) topics.push(this.#fb.control(paragraph));
  }
}
