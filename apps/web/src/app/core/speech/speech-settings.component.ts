import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SpeechService } from './speech.service';

/** Акцент (US/UK) і швидкість (1× / 0.75×) озвучки; вибір запам'ятовується в браузері. */
@Component({
  selector: 'wl-speech-settings',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (speech.available()) {
      <div class="speech-settings" role="group" [attr.aria-label]="'speech.settings' | transloco">
        <button
          type="button"
          class="chip"
          [title]="'speech.accent' | transloco"
          [attr.aria-label]="
            ('speech.accent' | transloco) + ': ' + (speech.accent() === 'en-GB' ? 'UK' : 'US')
          "
          (click)="speech.toggleAccent()"
        >
          {{ speech.accent() === 'en-GB' ? '🇬🇧 UK' : '🇺🇸 US' }}
        </button>
        <button
          type="button"
          class="chip"
          [title]="'speech.rate' | transloco"
          [attr.aria-label]="('speech.rate' | transloco) + ': ' + (speech.rate() === 1 ? '1×' : '0.75×')"
          (click)="speech.toggleRate()"
        >
          {{ speech.rate() === 1 ? '1×' : '0.75×' }}
        </button>
      </div>
    }
  `,
})
export class SpeechSettingsComponent {
  protected readonly speech = inject(SpeechService);
}
