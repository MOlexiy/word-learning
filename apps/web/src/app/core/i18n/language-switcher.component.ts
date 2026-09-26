import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { APP_LANGS } from './i18n.config';
import { LanguageService } from './language.service';

@Component({
  selector: 'wl-language-switcher',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lang-switch" role="group" [attr.aria-label]="'lang.label' | transloco">
      @for (lang of langs; track lang) {
        <button
          type="button"
          class="lang-switch__btn"
          [class.is-active]="language.lang() === lang"
          [attr.aria-pressed]="language.lang() === lang"
          [attr.lang]="lang === 'ua' ? 'uk' : 'en'"
          [title]="'lang.' + lang + 'Full' | transloco"
          (click)="language.use(lang)"
        >
          {{ 'lang.' + lang | transloco }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcherComponent {
  protected readonly language = inject(LanguageService);
  protected readonly langs = APP_LANGS;
}
