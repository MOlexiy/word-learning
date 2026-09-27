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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { CardInput, WordCard } from '@wl/shared';
import { ConfirmService } from '../../../core/confirm/confirm.service';
import { ErrorTranslator } from '../../../core/i18n/error-translator.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { CardStorageService } from '../data/card-storage.service';
import { CardNotFoundError } from '../data/cards.repository';
import { CardFormComponent } from '../ui/card-form.component';
import { CardViewComponent } from '../ui/card-view.component';

@Component({
  selector: 'wl-card-detail-page',
  imports: [CardViewComponent, CardFormComponent, ReactiveFormsModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/" class="back">{{ 'cards.detail.back' | transloco }}</a>

    @switch (state()) {
      @case ('loading') {
        <p class="muted">{{ 'common.loading' | transloco }}</p>
      }
      @case ('not-found') {
        <div class="empty">
          <p>{{ 'cards.detail.notFound' | transloco }}</p>
          <a class="btn" routerLink="/">{{ 'cards.detail.toCatalog' | transloco }}</a>
        </div>
      }
      @case ('error') {
        <p class="alert alert--error">{{ errorText() }}</p>
      }
      @default {
        @if (card(); as c) {
          <section class="panel">
            @if (editing()) {
              <wl-card-form
                mode="edit"
                [initial]="c"
                [busy]="busy()"
                (saved)="save($event)"
                (cancelled)="editing.set(false)"
              />
            } @else {
              <wl-card-view [card]="c" [canRemoveTopics]="true" (topicRemove)="removeTopic($event)" />

              <form class="add-topic" [formGroup]="topicForm" (ngSubmit)="addTopic()">
                <label class="field">
                  <span class="field__label">{{ 'cards.detail.newTopic' | transloco }}</span>
                  <textarea
                    class="input"
                    rows="3"
                    id="new-topic"
                    name="newTopic"
                    formControlName="text"
                    [placeholder]="'cards.detail.newTopicPlaceholder' | transloco"
                  ></textarea>
                </label>
                <button class="btn" type="submit" [disabled]="busy()">
                  {{ 'cards.detail.addTopic' | transloco }}
                </button>
              </form>

              <div class="actions actions--split">
                <button class="btn btn--primary" type="button" (click)="editing.set(true)">
                  {{ 'cards.detail.edit' | transloco }}
                </button>
                <button class="btn btn--danger" type="button" [disabled]="busy()" (click)="remove()">
                  {{ 'cards.detail.delete' | transloco }}
                </button>
              </div>
            }
          </section>
        }
      }
    }
  `,
})
export class CardDetailPage {
  /** Параметр маршруту /cards/:id (withComponentInputBinding). */
  readonly id = input.required<string>();

  readonly #storage = inject(CardStorageService);
  readonly #notify = inject(NotifyService);
  readonly #router = inject(Router);
  readonly #transloco = inject(TranslocoService);
  readonly #errors = inject(ErrorTranslator);
  readonly #confirm = inject(ConfirmService);

  protected readonly card = signal<WordCard | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  /** Сама помилка; текст рахується реактивно, тож перекладається при зміні мови. */
  protected readonly error = signal<unknown>(null);
  protected readonly errorText = computed(() => this.#errors.message(this.error()));
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly topicForm = new FormGroup({
    text: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(10_000)] }),
  });

  #requestSeq = 0;

  constructor() {
    effect(() => {
      const id = this.id();
      this.#storage.mode();
      untracked(() => void this.#open(id));
    });
  }

  protected async addTopic(): Promise<void> {
    const text = this.topicForm.controls.text.value.trim();
    if (!text) return;
    await this.#run(async () => {
      this.card.set(await this.#storage.addTopic(this.id(), text));
      this.topicForm.reset();
    });
  }

  protected async save(input: CardInput): Promise<void> {
    await this.#run(async () => {
      this.card.set(await this.#storage.update(this.id(), input));
      this.editing.set(false);
      this.#notify.success(this.#transloco.translate('cards.detail.saved'));
    });
  }

  protected async removeTopic({ index, text }: { index: number; text: string }): Promise<void> {
    const confirmed = await this.#confirm.ask({
      titleKey: 'cards.detail.deleteTopicTitle',
      messageKey: 'confirm.irreversible',
      quote: text,
      danger: true,
    });
    if (!confirmed) return;
    await this.#run(async () => {
      this.card.set(await this.#storage.removeTopic(this.id(), index, text));
      this.#notify.success(this.#transloco.translate('cards.detail.topicDeleted'));
    });
  }

  protected async remove(): Promise<void> {
    const card = this.card();
    const confirmed = await this.#confirm.ask({
      titleKey: 'cards.detail.deleteCardTitle',
      messageKey: 'cards.detail.deleteCardText',
      params: { name: card?.name ?? '' },
      danger: true,
    });
    if (!confirmed) return;
    await this.#run(async () => {
      await this.#storage.remove(this.id());
      this.#notify.success(this.#transloco.translate('cards.detail.deleted'));
      await this.#router.navigateByUrl('/');
    });
  }

  /** Відкриття картки збільшує лічильник k. Захист від гонки при швидкій зміні :id. */
  async #open(id: string): Promise<void> {
    const seq = ++this.#requestSeq;
    this.state.set('loading');
    this.editing.set(false);
    try {
      const card = await this.#storage.view(id);
      if (seq !== this.#requestSeq) return;
      this.card.set(card);
      this.state.set('ready');
    } catch (error: unknown) {
      if (seq !== this.#requestSeq) return;
      this.state.set(error instanceof CardNotFoundError ? 'not-found' : 'error');
      this.error.set(error);
    }
  }

  async #run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }
}
