import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

export type CollectionView = 'cards' | 'inbox';

/** `?view=inbox` → чернетка; будь-що інше → готові картки. */
export function toCollectionView(value: string | null | undefined): CollectionView {
  return value === 'inbox' ? 'inbox' : 'cards';
}

/**
 * Перемикач «Готові картки / Чернетка (N)» під заголовком. Стан — у URL (`?view=inbox`),
 * тож працюють «Назад», оновлення сторінки й посилання. Пошуковий запит зберігається.
 */
@Component({
  selector: 'wl-collection-tabs',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="seg seg--page" [attr.aria-label]="'cards.tabs.label' | transloco">
      <a
        class="seg__item"
        [class.is-active]="view() === 'cards'"
        [attr.aria-current]="view() === 'cards' ? 'page' : null"
        [routerLink]="[]"
        [queryParams]="{ view: null, draft: null }"
        queryParamsHandling="merge"
        replaceUrl
      >
        {{ 'cards.tabs.ready' | transloco }}
        @if (readyCount() !== null) {
          <span class="seg__count">{{ readyCount() }}</span>
        }
      </a>
      <a
        class="seg__item"
        [class.is-active]="view() === 'inbox'"
        [attr.aria-current]="view() === 'inbox' ? 'page' : null"
        [routerLink]="[]"
        [queryParams]="{ view: 'inbox' }"
        queryParamsHandling="merge"
        replaceUrl
      >
        {{ 'cards.tabs.inbox' | transloco }}
        @if (inboxCount()) {
          <span class="seg__badge">{{ inboxCount() }}</span>
        }
      </a>
    </nav>
  `,
})
export class CollectionTabsComponent {
  readonly view = input<CollectionView>('cards');
  /** null — ще невідомо (напр. відкрито одразу з пошуковим запитом). */
  readonly readyCount = input<number | null>(null);
  readonly inboxCount = input(0);
}
