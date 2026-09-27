import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Посилання на словники колокацій для поточного слова (відкриваються в новій вкладці).
 * Якщо слово ще не введене, посилання ведуть на сторінку без слова.
 */
@Component({
  selector: 'wl-collocation-links',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="collocation-links">
      @for (link of links(); track link.title) {
        <a
          class="collocation-links__link"
          [href]="link.url"
          target="_blank"
          rel="noopener noreferrer"
          [title]="'cards.collocationLinks.open' | transloco: { site: link.title }"
        >
          {{ link.title }} <span aria-hidden="true">↗</span>
        </a>
      }
    </span>
  `,
})
export class CollocationLinksComponent {
  readonly word = input<string | null | undefined>('');

  protected readonly links = computed(() => {
    const word = encodeURIComponent((this.word() ?? '').trim());
    return [
      { title: 'ozdic', url: `https://ozdic.com/word/${word}` },
      { title: 'wordreference', url: `https://www.wordreference.com/EnglishCollocations/${word}` },
    ];
  });
}
