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
import { pickRandom, type WordCardSummary } from '@wl/shared';
import { ErrorTranslator } from '../../core/i18n/error-translator.service';
import { CardGridComponent } from '../cards/ui/card-grid.component';
import { ProfileApi } from '../profile/profile.api';

@Component({
  selector: 'wl-student-cards-page',
  imports: [CardGridComponent, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/profile" class="back">{{ 'students.back' | transloco }}</a>
    <div class="page-head">
      <h1>
        {{ 'students.title' | transloco: { username: studentUserName() } }}
        <span class="muted">({{ cards().length }})</span>
      </h1>
      <button class="btn btn--primary" type="button" [disabled]="!cards().length" (click)="openRandom()">
        {{ 'students.random' | transloco }}
      </button>
    </div>
    <p class="muted">{{ 'students.readonlyHint' | transloco }}</p>

    @if (errorText()) {
      <p class="alert alert--error">{{ errorText() }}</p>
    } @else if (loading()) {
      <p class="muted">{{ 'common.loading' | transloco }}</p>
    } @else if (cards().length) {
      <wl-card-grid [cards]="cards()" [basePath]="['/students', studentUserName(), 'cards']" />
    } @else {
      <p class="muted">{{ 'students.empty' | transloco }}</p>
    }
  `,
})
export class StudentCardsPage {
  readonly studentUserName = input.required<string>();

  readonly #api = inject(ProfileApi);
  readonly #router = inject(Router);
  readonly #errors = inject(ErrorTranslator);

  protected readonly cards = signal<WordCardSummary[]>([]);
  protected readonly loading = signal(true);
  /** Сама помилка; текст рахується реактивно, тож перекладається при зміні мови. */
  protected readonly error = signal<unknown>(null);
  protected readonly errorText = computed(() => this.#errors.message(this.error()));

  constructor() {
    effect(() => {
      const username = this.studentUserName();
      untracked(() => void this.#load(username));
    });
  }

  /** Просто випадкова картка зі списку — без таймерів, прогресу чи запам'ятовування. */
  protected openRandom(): void {
    const card = pickRandom(this.cards());
    if (card) void this.#router.navigate(['/students', this.studentUserName(), 'cards', card.id]);
  }

  async #load(username: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.cards.set(await firstValueFrom(this.#api.studentCards(username)));
    } catch (error: unknown) {
      this.error.set(error);
    } finally {
      this.loading.set(false);
    }
  }
}
