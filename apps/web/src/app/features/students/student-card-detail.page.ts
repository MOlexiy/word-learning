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
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { pickRandom, type WordCard } from '@wl/shared';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { NotifyService } from '../../core/notify/notify.service';
import { CardViewComponent } from '../cards/ui/card-view.component';
import { ProfileApi } from '../profile/profile.api';
import { useStudentContext } from './student-context';

/** Картка учня для вчителя: тільки перегляд, лічильник k учня не змінюється. */
@Component({
  selector: 'wl-student-card-detail-page',
  imports: [CardViewComponent, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <a [routerLink]="['/students', studentUserName()]" class="back">
        {{ 'students.backToStudent' | transloco: { username: studentUserName() } }}
      </a>
      <button class="btn" type="button" [disabled]="busy()" (click)="openAnotherRandom()">
        {{ 'students.anotherRandom' | transloco }}
      </button>
    </div>
    @if (errorText()) {
      <p class="alert alert--error">{{ errorText() }}</p>
    } @else if (card(); as c) {
      <section class="panel">
        <span class="badge badge--readonly">{{ 'students.readonly' | transloco }}</span>
        <wl-card-view [card]="c" />
      </section>
    } @else {
      <p class="muted">{{ 'common.loading' | transloco }}</p>
    }
  `,
})
export class StudentCardDetailPage {
  readonly studentUserName = input.required<string>();
  readonly id = input.required<string>();

  readonly #api = inject(ProfileApi);
  readonly #router = inject(Router);
  readonly #notify = inject(NotifyService);
  readonly #errors = inject(ErrorTranslator);

  protected readonly card = signal<WordCard | null>(null);
  /** Сама помилка; текст рахується реактивно, тож перекладається при зміні мови. */
  protected readonly error = signal<unknown>(null);
  protected readonly errorText = computed(() => this.#errors.message(this.error()));
  protected readonly busy = signal(false);

  constructor() {
    useStudentContext(this.studentUserName);
    effect(() => {
      const [username, id] = [this.studentUserName(), this.id()];
      untracked(() => void this.#load(username, id));
    });
  }

  protected async openAnotherRandom(): Promise<void> {
    this.busy.set(true);
    try {
      const cards = await firstValueFrom(this.#api.studentCards(this.studentUserName()));
      const others = cards.length > 1 ? cards.filter((c) => c.id !== this.id()) : cards;
      const next = pickRandom(others);
      if (next) await this.#router.navigate(['/students', this.studentUserName(), 'cards', next.id]);
    } catch (error: unknown) {
      this.#notify.error(this.#errors.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  async #load(username: string, id: string): Promise<void> {
    this.card.set(null);
    this.error.set(null);
    try {
      this.card.set(await firstValueFrom(this.#api.studentCard(username, id)));
    } catch (error: unknown) {
      this.error.set(error);
    }
  }
}
