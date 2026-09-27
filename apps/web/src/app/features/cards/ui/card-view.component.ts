import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { WordCard } from '@wl/shared';
import { SelectionSpeakerComponent } from '../../../core/speech/selection-speaker.component';
import { SpeakButtonComponent } from '../../../core/speech/speak-button.component';
import { SpeechSettingsComponent } from '../../../core/speech/speech-settings.component';
import { SpeechService } from '../../../core/speech/speech.service';
import { SpokenTextComponent } from '../../../core/speech/spoken-text.component';
import { CARD_TEXT_FIELDS } from './card-fields';

/**
 * Read-only відображення всіх полів картки з озвучкою: кнопки 🔊 біля слова, англійських полів
 * і кожного параграфа, плюс озвучка довільного виділеного фрагмента.
 * Дії (редагування, додавання параграфів) додає батьківська сторінка.
 */
@Component({
  selector: 'wl-card-view',
  imports: [
    TranslocoPipe,
    SpeakButtonComponent,
    SpokenTextComponent,
    SelectionSpeakerComponent,
    SpeechSettingsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = card();
    <div #speakArea class="card-view">
      <header class="card-view__head">
        <h1 class="card-view__word" lang="en">{{ c.name }}</h1>
        <wl-speak-button [text]="c.name" [key]="c.id + ':name'" />
        <span class="badge" [title]="'cards.view.viewsHint' | transloco">👁 {{ c.k }}</span>
        <span class="spacer"></span>
        <wl-speech-settings />
      </header>

      <dl class="card-view__fields">
        @for (field of fields; track field.key) {
          <div class="card-view__row" [class.card-view__row--wide]="field.multiline">
            <dt>{{ field.labelKey | transloco }}</dt>
            @if (c[field.key]) {
              <dd class="speakable" [attr.lang]="field.speakable ? 'en' : null">
                @if (field.speakable) {
                  <wl-speak-button [text]="c[field.key]" [key]="c.id + ':' + field.key" />
                  <span><wl-spoken-text [text]="c[field.key]" [key]="c.id + ':' + field.key" /></span>
                } @else {
                  <span>{{ c[field.key] }}</span>
                }
              </dd>
            } @else {
              <dd class="muted">{{ 'common.empty' | transloco }}</dd>
            }
          </div>
        }
      </dl>

      <section>
        <h2 class="section-title">{{ 'cards.view.topics' | transloco: { count: c.topic.length } }}</h2>
        @if (c.topic.length) {
          @if (speech.available()) {
            <p class="hint muted">{{ 'speech.selectionHint' | transloco }}</p>
          }
          <ol class="topics">
            @for (paragraph of c.topic; track $index) {
              <li class="topics__item" lang="en">
                <wl-speak-button [text]="paragraph" [key]="c.id + ':topic:' + $index" />
                <span><wl-spoken-text [text]="paragraph" [key]="c.id + ':topic:' + $index" /></span>
              </li>
            }
          </ol>
        } @else {
          <p class="muted">{{ 'cards.view.noTopics' | transloco }}</p>
        }
      </section>
    </div>
    <wl-selection-speaker [container]="speakArea" />
  `,
})
export class CardViewComponent {
  readonly card = input.required<WordCard>();
  protected readonly fields = CARD_TEXT_FIELDS;
  protected readonly speech = inject(SpeechService);
}
