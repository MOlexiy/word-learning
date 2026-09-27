import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SpeechService } from './speech.service';

const MAX_SELECTION = 2_000;
const BUTTON_OFFSET = 44;

/**
 * Плаваюча кнопка «🔊 Озвучити виділене»: з'являється над виділеним текстом (мишею, подвійним кліком
 * по слову або довгим натисканням на телефоні) усередині `container`.
 */
@Component({
  selector: 'wl-selection-speaker',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:selectionchange)': 'update()',
    '(window:scroll)': 'update()',
    '(window:resize)': 'update()',
  },
  template: `
    @if (speech.available() && position(); as pos) {
      <button
        type="button"
        class="selection-speaker"
        [style.top.px]="pos.top"
        [style.left.px]="pos.left"
        (pointerdown)="$event.preventDefault()"
        (mousedown)="$event.preventDefault()"
        (click)="speak()"
      >
        <span aria-hidden="true">{{ active() ? '⏹' : '🔊' }}</span>
        {{ (active() ? 'speech.stop' : 'speech.speakSelection') | transloco }}
      </button>
    }
  `,
})
export class SelectionSpeakerComponent {
  /** Область, у якій реагуємо на виділення (поза нею кнопка не з'являється). */
  readonly container = input.required<HTMLElement>();

  protected readonly speech = inject(SpeechService);
  protected readonly position = signal<{ top: number; left: number } | null>(null);
  readonly #selected = signal('');
  readonly #spoken = signal('');
  /** «Стоп» — лише якщо звучить саме поточне виділення; для нового фрагмента кнопка знову «озвучити». */
  protected readonly active = computed(
    () => this.speech.speakingKey() === 'selection' && this.#spoken() === this.#selected(),
  );

  protected update(): void {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return this.#hide();
    const range = selection.getRangeAt(0);
    if (!this.container().contains(range.commonAncestorContainer)) return this.#hide();

    const text = selection.toString().replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_SELECTION) return this.#hide();

    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return this.#hide();

    this.#selected.set(text);
    const above = rect.top - BUTTON_OFFSET;
    const margin = 80;
    // На сенсорних екранах над виділенням з'являється системне меню «Копіювати…» — ставимо кнопку під ним.
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.position.set({
      top: !touch && above > 8 ? above : rect.bottom + 12,
      left: Math.min(Math.max(rect.left + rect.width / 2, margin), window.innerWidth - margin),
    });
  }

  protected speak(): void {
    if (this.active()) {
      this.speech.stop();
      return;
    }
    this.#spoken.set(this.#selected());
    this.speech.speak(this.#selected(), 'selection');
  }

  #hide(): void {
    this.#selected.set('');
    this.position.set(null);
  }
}
