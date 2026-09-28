import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { WordCardSummary } from '@wl/shared';

/** Грид карток: на плитці лише `name`. */
@Component({
  selector: 'wl-card-grid',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="grid">
      @for (card of cards(); track card.id) {
        <li>
          <a class="tile" [routerLink]="[...basePath(), card.id]" lang="en">{{ card.name }}</a>
        </li>
      }
    </ul>
  `,
})
export class CardGridComponent {
  readonly cards = input.required<readonly WordCardSummary[]>();
  /** Префікс маршруту: ['/cards'] або ['/students', username, 'cards']. */
  readonly basePath = input<readonly string[]>(['/cards']);
}
