import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Затримка між останнім натисканням клавіші та запитом до API. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Рядок пошуку. Користувач вводить лише запит — у яких полях шукати (name, n, v, adj, adv),
 * вирішує API. Текст віддається з затримкою (debounce); Enter — одразу, Esc — очистити.
 * Сам стан живе в URL (батьківська сторінка), тож пошук переживає перезавантаження.
 */
@Component({
  selector: 'wl-card-search',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-bar" role="search">
      <span class="search-bar__icon" aria-hidden="true">⌕</span>
      <input
        class="input search-bar__input"
        type="search"
        [id]="inputId()"
        name="q"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        enterkeyhint="search"
        [placeholder]="'common.search' | transloco"
        [attr.aria-label]="'cards.list.searchLabel' | transloco"
        [value]="text()"
        (input)="onInput($any($event.target).value)"
        (keydown.enter)="flush()"
        (keydown.escape)="clear()"
      />
      @if (pending()) {
        <span class="spinner search-bar__spinner" aria-hidden="true"></span>
      }
    </div>
  `,
})
export class CardSearchComponent {
  /** Поточний запит з URL. */
  readonly q = input('');
  /** Батько показує, що запит ще виконується. */
  readonly loading = input(false);
  readonly inputId = input('card-search');

  readonly searchChange = output<string>();

  protected readonly text = signal('');
  protected readonly pending = signal(false);

  #timer: ReturnType<typeof setTimeout> | null = null;
  /** Останній відданий назовні запит: зміну `q` на нього не вважаємо зовнішньою. */
  #emitted: string | null = null;

  constructor() {
    // Зовнішня зміна (назад/вперед у браузері, відкрите посилання) → оновити поле.
    effect(() => {
      const q = this.q();
      untracked(() => {
        if (q === this.#emitted) return;
        this.#emitted = q;
        this.#cancel();
        this.text.set(q);
      });
    });
    effect(() => {
      const loading = this.loading();
      untracked(() => this.pending.set(loading || this.#timer !== null));
    });
    inject(DestroyRef).onDestroy(() => this.#cancel());
  }

  protected onInput(value: string): void {
    this.text.set(value);
    this.#cancel();
    this.pending.set(true);
    this.#timer = setTimeout(() => this.flush(), SEARCH_DEBOUNCE_MS);
  }

  /** Enter — шукати одразу, без очікування. */
  protected flush(): void {
    this.#cancel();
    this.pending.set(this.loading());
    const q = this.text().trim();
    if (q === this.#emitted) return;
    this.#emitted = q;
    this.searchChange.emit(q);
  }

  protected clear(): void {
    if (!this.text()) return;
    this.text.set('');
    this.flush();
  }

  #cancel(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
