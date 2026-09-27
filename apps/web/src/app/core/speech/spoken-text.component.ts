import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SpeechService } from './speech.service';

/**
 * Текст, у якому під час озвучки підсвічується поточне слово.
 * Підсвітка працює там, де браузер надсилає події меж слів (Edge/Safari, більшість локальних голосів);
 * мережеві голоси Google у Chrome їх не надсилають — тоді текст просто озвучується без підсвітки.
 */
@Component({
  selector: 'wl-spoken-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (parts(); as p) {
      {{ p.before }}<mark class="spoken-word">{{ p.word }}</mark
      >{{ p.after }}
    } @else {
      {{ text() }}
    }
  `,
})
export class SpokenTextComponent {
  readonly text = input.required<string>();
  readonly key = input.required<string>();

  readonly #speech = inject(SpeechService);

  protected readonly parts = computed(() => {
    const word = this.#speech.currentWord();
    if (!word || word.key !== this.key()) return null;
    // Кнопка озвучує trim()-нутий текст — зсуви рахуємо від нього ж.
    const raw = this.text();
    const lead = raw.length - raw.trimStart().length;
    const start = word.start + lead;
    const end = word.end + lead;
    if (start < 0 || end > raw.length || start >= end) return null;
    return { before: raw.slice(0, start), word: raw.slice(start, end), after: raw.slice(end) };
  });
}
