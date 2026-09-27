import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SpeechService } from './speech.service';

let nextId = 0;

/** Кнопка 🔊 / ⏹: озвучує переданий текст; повторне натискання зупиняє. */
@Component({
  selector: 'wl-speak-button',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (speech.available() && text().trim()) {
      <button
        type="button"
        class="speak-btn"
        [class.is-active]="active()"
        [attr.aria-pressed]="active()"
        [attr.aria-label]="(active() ? 'speech.stop' : 'speech.play') | transloco"
        [title]="(active() ? 'speech.stop' : 'speech.play') | transloco"
        (click)="speech.toggle(text(), key())"
      >
        <span aria-hidden="true">{{ active() ? '⏹' : '🔊' }}</span>
      </button>
    }
  `,
})
export class SpeakButtonComponent {
  readonly text = input.required<string>();
  /** Унікальний ключ; за ним кнопка знає, що звучить саме її текст (і текст підсвічується). */
  readonly key = input(`speak-${++nextId}`);

  protected readonly speech = inject(SpeechService);
  protected readonly active = computed(() => this.speech.speakingKey() === this.key());
}
