import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { WordCard } from '@wl/shared';
import { CARD_TEXT_FIELDS } from './card-fields';

/** Read-only відображення всіх полів картки. Дії (редагування, параграфи) додає батьківська сторінка. */
@Component({
  selector: 'wl-card-view',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = card();
    <header class="card-view__head">
      <h1 class="card-view__word" lang="en">{{ c.name }}</h1>
      <span class="badge" [title]="'cards.view.viewsHint' | transloco">👁 {{ c.k }}</span>
    </header>

    <dl class="card-view__fields">
      @for (field of fields; track field.key) {
        <div class="card-view__row" [class.card-view__row--wide]="field.multiline">
          <dt>{{ field.labelKey | transloco }}</dt>
          <dd [class.muted]="!c[field.key]">{{ c[field.key] || ('common.empty' | transloco) }}</dd>
        </div>
      }
    </dl>

    <section>
      <h2 class="section-title">{{ 'cards.view.topics' | transloco: { count: c.topic.length } }}</h2>
      @if (c.topic.length) {
        <ol class="topics">
          @for (paragraph of c.topic; track $index) {
            <li class="topics__item">{{ paragraph }}</li>
          }
        </ol>
      } @else {
        <p class="muted">{{ 'cards.view.noTopics' | transloco }}</p>
      }
    </section>
  `,
})
export class CardViewComponent {
  readonly card = input.required<WordCard>();
  protected readonly fields = CARD_TEXT_FIELDS;
}
